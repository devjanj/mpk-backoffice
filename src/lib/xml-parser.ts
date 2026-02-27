import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { XMLParser } from 'fast-xml-parser'
import { FinanceRow } from './google-sheets'

export function parseEuropeanNumberHelper(str: string): number {
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

export function formatEuropeanNumberHelper(num: number): string {
    return num.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Parses the ISO 20022 XML bank export in the public folder 
 * and maps it to the shape of Google Sheets FinanceRow.
 * Balances are initially left empty and must be calculated sequentially by the caller.
 */
export async function getLocalXMLTransactions(): Promise<FinanceRow[]> {
    try {
        const filePath = path.join(process.cwd(), 'public', 'Main_Finance_2026.xml')

        if (!fs.existsSync(filePath)) {
            console.log("No local XML found at", filePath)
            return []
        }

        const xmlFile = fs.readFileSync(filePath, 'utf8')

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        })

        const jsonObj = parser.parse(xmlFile)

        // Navigate camt.052 structure
        const report = jsonObj?.Document?.BkToCstmrAcctRpt?.Rpt
        if (!report) return []

        let entries = report.Ntry
        if (!entries) return []

        // XMLParser might return a single object instead of array if there's only 1 Ntry
        if (!Array.isArray(entries)) {
            entries = [entries]
        }

        const mappedRows: FinanceRow[] = []

        for (const entry of entries) {
            const amount = parseFloat(entry.Amt?.['#text'] || entry.Amt || '0')
            const isCredit = entry.CdtDbtInd === 'CRDT'

            // Format dates (usually YYYY-MM-DD -> DD.MM.YYYY)
            const rawDate = entry.BookgDt?.Dt || entry.ValDt?.Dt || ''
            let formattedDate = rawDate
            let monthLabel = ''

            if (rawDate) {
                const parts = rawDate.split('-') // [2026, 01, 05]
                if (parts.length === 3) {
                    formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`
                    monthLabel = `${parseInt(parts[1])}.${parts[0].slice(-2)}` // e.g., "1.26" for January 2026
                }
            }

            // Extract Name/Description
            // If it's a CREDIT (Income), we look at who sent it (Debtor)
            // If it's a DEBIT (Outcome), we look at who received it (Creditor)
            const txDetails = entry.NtryDtls?.TxDtls
            let name = '-'
            let additionalInfo = ''

            if (txDetails) {
                const parties = txDetails.RltdPties
                if (isCredit && parties?.Dbtr?.Nm) {
                    name = parties.Dbtr.Nm
                } else if (!isCredit && parties?.Cdtr?.Nm) {
                    name = parties.Cdtr.Nm
                }

                additionalInfo = txDetails.RmtInf?.Strd?.AddtlRmtInf || txDetails.RmtInf?.Ustrd || ''
            }

            const description = name !== '-' ? name : additionalInfo || 'Neznana transakcija'
            const incomeStr = isCredit ? formatEuropeanNumberHelper(amount) : ''
            const outcomeStr = !isCredit ? formatEuropeanNumberHelper(amount) : ''

            // Generate deterministic hash mapping for DB splits
            // XML rows get their balances patched in later, so we omit from hash to prevent mismatch
            const rawString = `${formattedDate}-${description}-${incomeStr}-${outcomeStr}`
            const hashId = crypto.createHash('sha256').update(rawString).digest('hex')

            mappedRows.push({
                id: hashId,
                month: monthLabel,
                projectNumber: '-', // Bank exports don't have our internal project #
                date: formattedDate,
                description: description,
                income: incomeStr,
                outcome: outcomeStr,
                currentBalance: '', // To be calculated dynamically
                transactionUrl: '',
                notes: typeof additionalInfo === 'string' ? additionalInfo : ''
            })
        }

        // Bank exports are usually chronological or reverse chronological.
        // Let's ensure they are strictly oldest-to-newest by sorting on raw date if necessary, 
        // assuming standard format DD.MM.YYYY.
        mappedRows.sort((a, b) => {
            const getTimestamp = (dStr: string) => {
                if (!dStr) return 0
                const [d, m, y] = dStr.split('.')
                return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getTime()
            }
            return getTimestamp(a.date) - getTimestamp(b.date)
        })

        return mappedRows
    } catch (error) {
        console.error("Error parsing local XML:", error)
        return []
    }
}
