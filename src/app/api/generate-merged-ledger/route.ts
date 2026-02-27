import * as xlsx from 'xlsx'
import fs from 'fs'
import path from 'path'
import { syncFinanceSheet } from '@/lib/google-sheets'
import { getLocalXMLTransactions, parseEuropeanNumberHelper, formatEuropeanNumberHelper } from '@/lib/xml-parser'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'public', 'bankexport.xlsx')
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ success: false, error: 'bankexport.xlsx not found in public folder.' })
        }

        const fileBuffer = fs.readFileSync(filePath)
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const bankDataRaw = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[]

        // Extract 2025 Bank rows (Data starts around row 9 based on NLB format)
        const bank2025 = []
        for (let i = 9; i < bankDataRaw.length; i++) {
            const row = bankDataRaw[i]
            if (!row || row.length === 0 || !row[0]) continue

            const rawDate = row[1] || row[0] // datum valute or datum knjizenja
            const parts = String(rawDate).split(' ')[0] // getting just "DD.MM.YYYY"

            // NLB sometimes formats empty rows strangely, skip if no date
            if (!parts || !parts.includes('.')) continue;

            const name = row[4] || ''
            const purpose = row[8] || ''
            const description = name !== '' ? name : purpose

            const outcomeRaw = row[9] ? String(row[9]) : ''
            const incomeRaw = row[10] ? String(row[10]) : ''

            const income = parseEuropeanNumberHelper(incomeRaw)
            const outcome = parseEuropeanNumberHelper(outcomeRaw)

            const balanceRaw = row[11] ? String(row[11]) : ''
            const balance = parseEuropeanNumberHelper(balanceRaw)

            bank2025.push({
                date: parts,
                description: String(description).trim(),
                incomeNum: income,
                outcomeNum: outcome,
                balanceNum: balance,
                incomeStr: income > 0 ? formatEuropeanNumberHelper(income) : '',
                outcomeStr: outcome > 0 ? formatEuropeanNumberHelper(outcome) : '',
                projectNumber: '-',
                transactionUrl: '',
                notes: String(purpose).trim() !== String(name).trim() ? String(purpose).trim() : ''
            })
        }

        // Fetch 2026 XML
        const xml2026 = await getLocalXMLTransactions()

        // The XML doesn't contain a running balance, so we start from the last known 2025 balance
        let lastRunningBalance = bank2025.length > 0 ? bank2025[bank2025.length - 1].balanceNum : 0

        const bank2026 = xml2026.map(row => {
            const inc = parseEuropeanNumberHelper(row.income)
            const out = parseEuropeanNumberHelper(row.outcome)

            // Advance the running balance chronologically
            lastRunningBalance = lastRunningBalance + inc - out

            return {
                date: row.date,
                description: row.description,
                incomeNum: inc,
                outcomeNum: out,
                balanceNum: lastRunningBalance,
                incomeStr: row.income,
                outcomeStr: row.outcome,
                projectNumber: '-',
                transactionUrl: '',
                notes: row.notes
            }
        })

        // Combined Master Bank List
        const masterBank = [...bank2025, ...bank2026]

        // Fetch Google Sheet Data (it contains 2025 up to 1.12 with projects)
        // Note: syncFinanceSheet also automatically fetches and appends the 2026 XML to the end.
        // But for our cross-referencing, having duplications in gSheetReq is fine as long as we map correctly.
        const gSheetReq = await syncFinanceSheet()
        const gSheetData = (gSheetReq.success && gSheetReq.data) ? gSheetReq.data.map(r => ({ ...r, usedToMap: false })) : []

        // Find matches in the Google Sheet data to rescue the "Project Numbers" and "transaction URLs"
        let matchCount = 0
        for (const bRow of masterBank) {
            const matchIndex = gSheetData.findIndex(gRow => {
                if (gRow.usedToMap) return false;

                const gInc = parseEuropeanNumberHelper(gRow.income)
                const gOut = parseEuropeanNumberHelper(gRow.outcome)

                if (gInc === 0 && gOut === 0) return false

                const amountMatch = (gInc === bRow.incomeNum) && (gOut === bRow.outcomeNum)
                if (!amountMatch) return false

                // Extra security check: Verify the month is roughly the exact same
                let gMonth = -1
                if (gRow.date) {
                    const parts = gRow.date.split('.')
                    if (parts.length >= 2) gMonth = parseInt(parts[1])
                }

                const [bd, bm, by] = bRow.date.split('.')
                const bMonth = parseInt(bm)

                if (bMonth === gMonth) return true

                return false
            })

            if (matchIndex !== -1) {
                const bestMatch = gSheetData[matchIndex]
                gSheetData[matchIndex].usedToMap = true // Prevent double matching for identical payments

                if (bestMatch.projectNumber?.trim() && bestMatch.projectNumber !== '-') {
                    bRow.projectNumber = bestMatch.projectNumber.trim()
                }
                if (bestMatch.transactionUrl?.trim()) {
                    bRow.transactionUrl = bestMatch.transactionUrl.trim()
                }
                if (bestMatch.notes?.trim() && bestMatch.notes !== bRow.notes) {
                    bRow.notes = bRow.notes ? (bRow.notes + " | " + bestMatch.notes.trim()) : bestMatch.notes.trim()
                }
                matchCount++
            }
        }

        // Create Excel Workbook Layout
        // Provide standard column names the user will expect
        const worksheetData = masterBank.map(row => ({
            "Datum": row.date,
            "Projektna Številka": row.projectNumber === '-' ? '' : row.projectNumber,
            "Komitent / Opis": row.description,
            "Priliv (EUR)": row.incomeNum === 0 ? '' : row.incomeNum,
            "Odliv (EUR)": row.outcomeNum === 0 ? '' : row.outcomeNum,
            "Stanje (EUR)": row.balanceNum === 0 ? '' : row.balanceNum,
            "URL Povezava": row.transactionUrl,
            "Opombe": row.notes
        }))

        const finalSheet = xlsx.utils.json_to_sheet(worksheetData)

        // Adjust column widths purely for aesthetic
        finalSheet['!cols'] = [
            { wch: 12 }, // Datum
            { wch: 18 }, // Projekt
            { wch: 45 }, // Opis
            { wch: 15 }, // Priliv
            { wch: 15 }, // Odliv
            { wch: 15 }, // Stanje
            { wch: 30 }, // URL
            { wch: 50 }, // Opombe
        ];

        const finalWb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(finalWb, finalSheet, "Merged Finance Ledger")

        const outPath = path.join(process.cwd(), 'public', 'Merged_Finance_Master.xlsx')
        const fileBufferOut = xlsx.write(finalWb, { type: 'buffer', bookType: 'xlsx' })
        fs.writeFileSync(outPath, fileBufferOut)

        return NextResponse.json({
            success: true,
            totalMerged: masterBank.length,
            matchedProjects: matchCount,
            fileUrl: '/Merged_Finance_Master.xlsx'
        })

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message })
    }
}
