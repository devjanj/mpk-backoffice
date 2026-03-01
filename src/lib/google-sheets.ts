'use server'

import { sheetsClient, driveClient } from '@/lib/google'
import prisma from '@/lib/prisma'
import * as xlsx from 'xlsx'
import ExcelJS from 'exceljs'
import crypto from 'crypto'
import { Readable } from 'stream'
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

function parseExcelDateToTimestamp(dateStr: string): number {
    if (!dateStr) return 0
    const parts = String(dateStr).trim().split('.')
    if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).valueOf()
    }
    return 0
}

export async function findFinanceSheetId(): Promise<string | null> {
    if (process.env.GOOGLE_SHEET_ID) {
        return process.env.GOOGLE_SHEET_ID
    }

    try {
        // Search the drive for the specific file name the user provided
        const response = await driveClient.files.list({
            q: "name = 'Merged_finance.xlsx' and trashed = false",
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true, // For list queries, this is also requested
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
            { fileId: spreadsheetId, alt: 'media', supportsAllDrives: true },
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

            // Generate deterministic fingerprint for database mapping. 
            // We EXPLICITLY ignore the balance column so that if users insert rows chronologically 
            // and the balance cascades, the ID remains perfectly stable.
            const rawString = `${dateStr}-${descriptionStr}-${incomeStr}-${outcomeStr}`
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

        // Dynamically calculate missing formulas
        let runningBalance = 0;
        for (let i = 0; i < filteredData.length; i++) {
            const row = filteredData[i];

            const rawCellBalance = parseEuropeanNumberHelper(row.currentBalance);
            const inc = parseEuropeanNumberHelper(row.income) || 0;
            const out = parseEuropeanNumberHelper(row.outcome) || 0;

            if (i === 0) {
                runningBalance = !isNaN(rawCellBalance) && row.currentBalance.trim() !== '' && !row.currentBalance.includes('[object')
                    ? rawCellBalance
                    : inc - Math.abs(out);
            } else {
                runningBalance = runningBalance + inc - Math.abs(out);
            }

            // ALWAYS override to the mathematically correct dynamically calculated value!
            // This prevents the JS loop from snapping back to stale Google Sheet cached values 
            // on rows situated after a chronologically spliced invoice.
            row.currentBalance = formatEuropeanNumberHelper(runningBalance);
        }

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

    // We now send ALL months to the frontend to allow dynamic 3M, 6M, 1Y, ALL filtering
    const allMonths = Object.keys(monthlyBalances)

    const historicalBalances = allMonths.map(month => ({
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
        allRawData: enrichedData,
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
            { fileId: spreadsheetId, alt: 'media', supportsAllDrives: true },
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
            // EXCLUDE balance so chronological inserts don't orphan database splits
            const rawString = `${finalDateStr}-${descriptionStr}-${incomeStr}-${outcomeStr}`
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

        let runningBalance = 0;
        for (let i = 0; i < filteredData.length; i++) {
            const row = filteredData[i];

            const rawCellBalance = parseEuropeanNumberHelper(row.currentBalance);
            const inc = parseEuropeanNumberHelper(row.income) || 0;
            const out = parseEuropeanNumberHelper(row.outcome) || 0;

            if (i === 0) {
                runningBalance = !isNaN(rawCellBalance) && row.currentBalance.trim() !== '' && !row.currentBalance.includes('[object')
                    ? rawCellBalance
                    : inc - Math.abs(out);
            } else {
                runningBalance = runningBalance + inc - Math.abs(out);
            }

            // ALWAYS override to the mathematically correct dynamically calculated value!
            // This prevents the JS loop from snapping back to stale Google Sheet cached values 
            // on rows situated after a chronologically spliced invoice.
            row.currentBalance = formatEuropeanNumberHelper(runningBalance);
        }

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
        return {
            ...row,
            activeMonth,
            notes: row.note,
            transactionUrl: row.invoiceUrl
        }
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

    const historicalBalances = allMonths.map(month => ({
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

export async function appendInvoiceToSheet(invoice: {
    source: string,
    date: string,
    projectNumber: string,
    description: string,
    shortDescription?: string,
    parsedAmount: number,
    driveFileLink: string | null
}) {
    const spreadsheetId = await findFinanceSheetId()

    if (!spreadsheetId) {
        throw new Error('Could not find Merged_finance.xlsx in the shared Google Drive folder.')
    }

    const fileResponse = await driveClient.files.get(
        { fileId: spreadsheetId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
    )

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(fileResponse.data as ArrayBuffer)

    const sheetName = invoice.source === 'CF' ? 'CF' : workbook.worksheets[0].name
    const sheet = workbook.getWorksheet(sheetName)

    if (!sheet) {
        throw new Error(`Sheet tab ${sheetName} not found in Merged_finance.xlsx`)
    }

    const income = invoice.parsedAmount >= 0 ? invoice.parsedAmount : null
    const outcome = invoice.parsedAmount < 0 ? Math.abs(invoice.parsedAmount) : null

    // Find the true last row
    let trueBottom = sheet.rowCount
    for (let i = sheet.rowCount; i >= 1; i--) {
        const row = sheet.getRow(i)
        const colA = String(row.getCell(1).value || '').trim()
        if (colA !== '' && colA.length >= 3 && colA !== '-' && colA !== 'undefined') {
            trueBottom = i
            break
        }
    }

    // Chronological Insertion Logic
    let insertIndexRow = trueBottom + 1
    const newDateVal = parseExcelDateToTimestamp(invoice.date)

    if (newDateVal > 0) {
        let foundChronologicalSpot = false
        for (let i = trueBottom; i >= 2; i--) { // skip header at 1
            const row = sheet.getRow(i)
            // Main sheet Date is column A (1). CF sheet Date is column C (3).
            const dateCol = invoice.source === 'CF' ? 3 : 1

            let sheetDateStr = ''
            const cellValue = row.getCell(dateCol).value
            if (cellValue instanceof Date) {
                sheetDateStr = `${cellValue.getDate()}.${cellValue.getMonth() + 1}.${cellValue.getFullYear()}`
            } else {
                sheetDateStr = String(cellValue || '').trim()
            }

            const sheetDateVal = parseExcelDateToTimestamp(sheetDateStr)

            if (sheetDateVal > 0) {
                if (newDateVal >= sheetDateVal) {
                    insertIndexRow = i + 1
                    foundChronologicalSpot = true
                    break
                }
            }
        }
        if (!foundChronologicalSpot && trueBottom >= 2) {
            insertIndexRow = 2
        }
    }

    const prevExcelRow = insertIndexRow - 1

    let newRowData: any[] = []

    if (invoice.source === 'CF') {
        const parts = invoice.date.split('.')
        let monthLabel = ''
        if (parts.length >= 3) {
            monthLabel = `${parseInt(parts[1])}.${parts[2].slice(-2)}`
        }

        const formulaObj = insertIndexRow > 2
            ? { formula: `G${prevExcelRow}+E${insertIndexRow}-F${insertIndexRow}` }
            : { formula: `E${insertIndexRow}-F${insertIndexRow}` }

        newRowData = [
            monthLabel,
            invoice.projectNumber || '',
            invoice.date,
            invoice.description,
            income,
            outcome,
            formulaObj,
            invoice.driveFileLink || '',
            invoice.shortDescription || ''
        ]
    } else {
        const formulaObj = insertIndexRow > 2
            ? { formula: `F${prevExcelRow}+D${insertIndexRow}-E${insertIndexRow}` }
            : { formula: `D${insertIndexRow}-E${insertIndexRow}` }

        newRowData = [
            invoice.date,
            invoice.projectNumber || '',
            invoice.description,
            income,
            outcome,
            formulaObj,
            invoice.driveFileLink || '',
            invoice.shortDescription || '',
            ''
        ]
    }

    // Splice perfectly preserves all surrounding formatting, colors, and relative formulas.
    sheet.spliceRows(insertIndexRow, 0, newRowData)

    const newBuffer = await workbook.xlsx.writeBuffer()

    const stream = new Readable()
    stream.push(Buffer.from(newBuffer))
    stream.push(null)

    await driveClient.files.update({
        fileId: spreadsheetId,
        media: {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            body: stream
        },
        supportsAllDrives: true
    })
}

export async function removeInvoiceFromSheet(driveFileId: string) {
    const spreadsheetId = await findFinanceSheetId()

    if (!spreadsheetId) {
        throw new Error('Could not find Merged_finance.xlsx in the shared Google Drive folder.')
    }

    const fileResponse = await driveClient.files.get(
        { fileId: spreadsheetId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
    )

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(fileResponse.data as ArrayBuffer)

    const driveLink = `https://drive.google.com/file/d/${driveFileId}/view?usp=drivesdk`
    let sheetModified = false

    const tabsToCheck = [workbook.worksheets[0].name, 'CF']

    for (const sheetName of tabsToCheck) {
        const sheet = workbook.getWorksheet(sheetName)
        if (!sheet) continue

        let deletedRowIndex = -1

        for (let i = sheet.rowCount; i >= 1; i--) {
            const row = sheet.getRow(i)
            // Main sheet URL is G (7), CF sheet URL is H (8)
            const colG = String(row.getCell(7).value || '').trim()
            const colH = String(row.getCell(8).value || '').trim()
            if (colG === driveLink || colH === driveLink) {
                deletedRowIndex = i
                break
            }
        }

        if (deletedRowIndex !== -1) {
            sheet.spliceRows(deletedRowIndex, 1)
            sheetModified = true
            break
        }
    }

    if (sheetModified) {
        const newBuffer = await workbook.xlsx.writeBuffer()
        const stream = new Readable()
        stream.push(Buffer.from(newBuffer))
        stream.push(null)

        await driveClient.files.update({
            fileId: spreadsheetId,
            media: {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                body: stream
            },
            supportsAllDrives: true
        })
    }
}
