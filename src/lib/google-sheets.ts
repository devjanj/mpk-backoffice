'use server'

import { sheetsClient, driveClient } from '@/lib/google'
import prisma from '@/lib/prisma'
import * as xlsx from 'xlsx'
import crypto from 'crypto'
import { getLocalXMLTransactions, parseEuropeanNumberHelper, formatEuropeanNumberHelper } from './xml-parser'

function formatMonthLabel(m: string): string {
    if (!m) return m
    const parts = m.split('.')
    if (parts.length >= 2) {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        const monthNum = parseInt(parts[0]) - 1
        if (monthNum >= 0 && monthNum <= 11) {
            return monthNames[monthNum]
        }
    }
    return m
}

export async function findFinanceSheetId(): Promise<string | null> {
    try {
        // Search the drive for the specific file name the user provided
        const response = await driveClient.files.list({
            q: "name = 'Merged_finance.xlsx' and trashed = false",
            fields: 'files(id, name)',
        })

        const files = response.data.files
        if (files && files.length > 0) {
            return files[0].id || null
        }
        return null
    } catch (error) {
        console.error('Error finding finance sheet:', error)
        return null
    }
}

export type FinanceRow = {
    id: string;
    month: string;
    projectNumber: string;
    date: string;
    description: string;
    income: string;
    outcome: string;
    currentBalance: string;
    transactionUrl: string;
    notes: string;
}

export async function syncFinanceSheet(): Promise<{ success: boolean; data?: FinanceRow[]; error?: string }> {
    try {
        const spreadsheetId = await findFinanceSheetId()

        if (!spreadsheetId) {
            return { success: false, error: 'Could not find "Merged_finance.xlsx" in the shared Google Drive folder. Please ensure it is shared with the Service Account email.' }
        }

        // Fetch the raw .xlsx file directly from Google Drive
        const fileResponse = await driveClient.files.get(
            { fileId: spreadsheetId, alt: 'media' },
            { responseType: 'arraybuffer' }
        )

        const fileBuffer = Buffer.from(fileResponse.data as any)
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[]
        if (!rows || rows.length <= 1) { // Only headers or empty
            return { success: true, data: [] }
        }

        // The first row of our array is headers. The rest is raw data.
        const dataRows = rows.slice(1)

        const parsedData: FinanceRow[] = dataRows.map(row => {
            const dateStr = String(row[0] || '')
            let monthLabel = ''
            if (dateStr) {
                const parts = dateStr.split('.')
                // e.g., 05.02.2025 -> 2.25
                if (parts.length >= 3) {
                    monthLabel = `${parseInt(parts[1])}.${parts[2].slice(-2)}`
                }
            }

            const descriptionStr = String(row[2] || '')
            const incomeStr = String(row[3] || '')
            const outcomeStr = String(row[4] || '')
            const balanceStr = String(row[5] || '')

            // Generate deterministic fingerprint for database mapping
            const rawString = `${dateStr}-${descriptionStr}-${incomeStr}-${outcomeStr}-${balanceStr}`
            const hashId = crypto.createHash('sha256').update(rawString).digest('hex')

            return {
                id: hashId,
                month: monthLabel,
                projectNumber: String(row[1] || ''),
                date: dateStr,
                description: descriptionStr,
                income: incomeStr,
                outcome: outcomeStr,
                currentBalance: balanceStr,
                transactionUrl: String(row[6] || ''),
                notes: String(row[7] || ''),
            }
        })

        // Filter out rows that are entirely empty
        let filteredData = parsedData.filter(row =>
            row.date !== '' || row.description !== '' || row.income !== '' || row.outcome !== ''
        )

        console.log(`Successfully parsed ${filteredData.length} total finance records.`)

        return { success: true, data: filteredData }
    } catch (error: any) {
        console.error('Error reading finance sheet:', error)
        return { success: false, error: error.message || 'Failed to read from Google Sheet' }
    }
}

export async function getFinanceDashboardMetrics() {
    const result = await syncFinanceSheet()
    if (!result.success || !result.data || result.data.length === 0) return null

    const data = result.data

    // Propagate the "month" column downwards since it might only be set on the first row of each month
    let activeMonth = ""
    const enrichedData = data.map(row => {
        if (row.month?.trim()) activeMonth = row.month.trim()
        return { ...row, activeMonth }
    })

    // Find the latest non-empty current balance starting from the bottom
    let currentBalanceStr = "€ 0,00"
    for (let i = enrichedData.length - 1; i >= 0; i--) {
        if (enrichedData[i].currentBalance?.trim()) {
            currentBalanceStr = enrichedData[i].currentBalance
            break
        }
    }

    // The last row's active month is the Current Month
    const lastActiveMonth = enrichedData[enrichedData.length - 1]?.activeMonth || ""

    // Go backwards to find the distinct month before the current month
    let previousActiveMonth = ""
    for (let i = enrichedData.length - 1; i >= 0; i--) {
        if (enrichedData[i].activeMonth !== lastActiveMonth) {
            previousActiveMonth = enrichedData[i].activeMonth
            break
        }
    }

    function parseEuropeanNumber(str: string): number {
        if (!str) return 0
        let cleaned = str.replace(/[^0-9.,-]/g, '')
        const lastComma = cleaned.lastIndexOf(',')
        const lastDot = cleaned.lastIndexOf('.')

        if (lastComma > lastDot) {
            // Format like 1.234,56
            cleaned = cleaned.replace(/\./g, '').replace(',', '.')
        } else if (lastDot > lastComma) {
            // Format like 1,234.56
            cleaned = cleaned.replace(/,/g, '')
        } else if (lastComma !== -1 && lastDot === -1) {
            // Format like 1234,56
            cleaned = cleaned.replace(',', '.')
        }
        return parseFloat(cleaned) || 0
    }

    // Historical Balances grouping (last balance of each month)
    const monthlyBalances: Record<string, number> = {}
    enrichedData.forEach(row => {
        const month = row.activeMonth
        if (month && row.currentBalance?.trim()) {
            const val = parseEuropeanNumber(row.currentBalance)
            if (val !== 0) {
                monthlyBalances[month] = val
            }
        }
    })

    // Grab the last 6 months chronologically
    const allMonths = Object.keys(monthlyBalances)
    // Since sheet is chronologically ordered top to bottom, the array keys are naturally in chronological order.
    // We slice the last 6
    const last6Months = allMonths.slice(-6)

    const historicalBalances = last6Months.map(month => ({
        month: formatMonthLabel(month),
        balance: monthlyBalances[month]
    }))

    const currentMonthIncome = enrichedData
        .filter(row => row.activeMonth === lastActiveMonth)
        .reduce((sum, row) => sum + parseEuropeanNumber(row.income), 0)

    const previousMonthIncome = enrichedData
        .filter(row => row.activeMonth === previousActiveMonth)
        .reduce((sum, row) => sum + parseEuropeanNumber(row.income), 0)

    const novemberIncome = enrichedData
        .filter(row => row.activeMonth.toLowerCase().includes('nov') || row.activeMonth.includes('.11.') || row.activeMonth.startsWith('11.'))
        .reduce((sum, row) => sum + parseEuropeanNumber(row.income), 0)

    let percentageChange = 0
    if (previousMonthIncome > 0) {
        percentageChange = ((currentMonthIncome - previousMonthIncome) / previousMonthIncome) * 100
    } else if (currentMonthIncome > 0) {
        percentageChange = 100
    }

    if (currentBalanceStr !== "€ 0,00") {
        const parsedBalance = parseEuropeanNumber(currentBalanceStr)
        currentBalanceStr = `€ ${parsedBalance.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    return {
        currentBalance: currentBalanceStr,
        currentMonthIncome,
        previousMonthIncome,
        novemberIncome,
        percentageChange,
        currentMonthName: formatMonthLabel(lastActiveMonth),
        previousMonthName: formatMonthLabel(previousActiveMonth),
        historicalBalances,
        rawData: enrichedData.slice(-5).reverse() // Pass the 5 latest records for a table preview
    }
}

export type CFRow = {
    id: string;
    month: string;
    projectNumber: string;
    date: string;
    description: string;
    income: string;
    outcome: string;
    currentBalance: string;
    invoiceUrl: string;
    note: string;
}

export async function syncCFSheet(): Promise<{ success: boolean; data?: CFRow[]; error?: string }> {
    try {
        const spreadsheetId = await findFinanceSheetId()

        if (!spreadsheetId) {
            return { success: false, error: 'Could not find "02_FINANCE_COPY" in the shared Google Drive folder.' }
        }

        // Fetch the raw .xlsx file directly from Google Drive
        const fileResponse = await driveClient.files.get(
            { fileId: spreadsheetId, alt: 'media' },
            { responseType: 'arraybuffer' }
        )

        const fileBuffer = Buffer.from(fileResponse.data as any)
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' })

        const sheet = workbook.Sheets['CF']
        if (!sheet) {
            console.log("CF tab not found in Merged_finance.xlsx. Returning empty array.")
            return { success: true, data: [] }
        }

        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[]
        if (!rows || rows.length <= 1) {
            return { success: true, data: [] }
        }

        const dataRows = rows.slice(2)

        const parsedData: CFRow[] = dataRows.map(row => {
            let dateVal = row[2]
            let finalDateStr = String(dateVal || '')
            // Convert Excel serial dates (e.g. 45689)
            if (typeof dateVal === 'number' && dateVal > 40000) {
                const date_info = new Date((dateVal - 25569) * 86400 * 1000)
                finalDateStr = `${date_info.getDate()}.${date_info.getMonth() + 1}.${date_info.getFullYear()}`
            }

            const descriptionStr = String(row[3] || '')
            const incomeStr = String(row[4] || '')
            const outcomeStr = String(row[5] || '')
            const balanceStr = String(row[6] || '')

            // Generate deterministic fingerprint for database mapping
            const rawString = `${finalDateStr}-${descriptionStr}-${incomeStr}-${outcomeStr}-${balanceStr}`
            const hashId = crypto.createHash('sha256').update(rawString).digest('hex')

            return {
                id: hashId,
                month: String(row[0] || ''),
                projectNumber: String(row[1] || ''),
                date: finalDateStr,
                description: descriptionStr,
                income: incomeStr,
                outcome: outcomeStr,
                currentBalance: balanceStr,
                invoiceUrl: String(row[7] || ''),
                note: String(row[8] || ''),
            }
        })

        // Filter out completely empty rows or repeated table headers
        const filteredData = parsedData.filter(row =>
            (row.date !== '' || row.description !== '' || row.income !== '' || row.outcome !== '') &&
            row.date.toLowerCase() !== 'date' &&
            row.date.toLowerCase() !== 'datum' &&
            row.month.toLowerCase() !== 'mesec' &&
            row.description.toLowerCase() !== 'description'
        )

        return { success: true, data: filteredData }
    } catch (error: any) {
        console.error('Error reading CF sheet:', error)
        return { success: false, error: error.message || 'Failed to read CF from Google Sheet' }
    }
}

export async function getCFDashboardMetrics() {
    const result = await syncCFSheet()
    if (!result.success || !result.data || result.data.length === 0) return null

    const data = result.data

    let activeMonth = ""
    const enrichedData = data.map(row => {
        if (row.month?.trim()) activeMonth = row.month.trim()
        return { ...row, activeMonth }
    })

    let currentBalanceStr = "€ 0,00"
    for (let i = enrichedData.length - 1; i >= 0; i--) {
        if (enrichedData[i].currentBalance?.trim()) {
            currentBalanceStr = enrichedData[i].currentBalance
            break
        }
    }

    const lastActiveMonth = enrichedData[enrichedData.length - 1]?.activeMonth || ""

    let previousActiveMonth = ""
    for (let i = enrichedData.length - 1; i >= 0; i--) {
        if (enrichedData[i].activeMonth !== lastActiveMonth) {
            previousActiveMonth = enrichedData[i].activeMonth
            break
        }
    }

    function parseEuropeanNumber(str: string): number {
        if (!str) return 0
        let cleaned = str.replace(/[^0-9.,-]/g, '')
        const lastComma = cleaned.lastIndexOf(',')
        const lastDot = cleaned.lastIndexOf('.')

        if (lastComma > lastDot) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.')
        } else if (lastDot > lastComma) {
            cleaned = cleaned.replace(/,/g, '')
        } else if (lastComma !== -1 && lastDot === -1) {
            cleaned = cleaned.replace(',', '.')
        }
        return parseFloat(cleaned) || 0
    }

    const currentMonthIncome = enrichedData
        .filter(row => row.activeMonth === lastActiveMonth)
        .reduce((sum, row) => sum + parseEuropeanNumber(row.income), 0)

    const previousMonthIncome = enrichedData
        .filter(row => row.activeMonth === previousActiveMonth)
        .reduce((sum, row) => sum + parseEuropeanNumber(row.income), 0)

    const novemberIncome = enrichedData
        .filter(row => row.activeMonth.toLowerCase().includes('nov') || row.activeMonth.includes('.11.') || row.activeMonth.startsWith('11.'))
        .reduce((sum, row) => sum + parseEuropeanNumber(row.income), 0)

    let percentageChange = 0
    if (previousMonthIncome > 0) {
        percentageChange = ((currentMonthIncome - previousMonthIncome) / previousMonthIncome) * 100
    } else if (currentMonthIncome > 0) {
        percentageChange = 100
    }

    const monthlyBalances: Record<string, number> = {}
    enrichedData.forEach(row => {
        const month = row.activeMonth
        if (month && row.currentBalance?.trim()) {
            const val = parseEuropeanNumber(row.currentBalance)
            if (val !== 0) {
                monthlyBalances[month] = val
            }
        }
    })

    const allMonths = Object.keys(monthlyBalances)
    const last6Months = allMonths.slice(-6)

    const historicalBalances = last6Months.map(month => ({
        month: formatMonthLabel(month),
        balance: monthlyBalances[month]
    }))

    if (currentBalanceStr !== "€ 0,00") {
        const parsedBalance = parseEuropeanNumber(currentBalanceStr)
        currentBalanceStr = `€ ${parsedBalance.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    return {
        currentBalance: currentBalanceStr,
        currentMonthIncome,
        previousMonthIncome,
        novemberIncome,
        percentageChange,
        currentMonthName: formatMonthLabel(lastActiveMonth),
        previousMonthName: formatMonthLabel(previousActiveMonth),
        historicalBalances,
        rawData: enrichedData.slice(-5).reverse(), // Pass the 5 latest records for a table preview
        allRawData: enrichedData
    }
}
