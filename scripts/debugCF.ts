import { driveClient } from '@/lib/google'
import * as xlsx from 'xlsx'
import { findFinanceSheetId } from '@/lib/google-sheets'

async function debugCF() {
    try {
        const id = await findFinanceSheetId()
        console.log("Spreadsheet ID:", id)
        if (!id) return;

        const fileResponse = await driveClient.files.get(
            { fileId: id, alt: 'media' },
            { responseType: 'arraybuffer' }
        )

        const fileBuffer = Buffer.from(fileResponse.data as any)
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' })

        console.log("Found Sheet Names:", workbook.SheetNames)

        // Try exact match first, or fall back to finding one that contains CF
        let targetName = workbook.SheetNames.find(name => name.toLowerCase().includes('cf'))
        if (!targetName) {
            console.log("No tab containing 'CF' found.")
            return;
        }

        console.log(`Using tab: '${targetName}'`)

        const sheet = workbook.Sheets[targetName]
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[]

        console.log(`Total rows in '${targetName}':`, rows.length)
        if (rows.length > 0) {
            console.log("Row 0:", rows[0])
            console.log("Row 1:", rows[1])
            console.log("Row 2:", rows[2])
            console.log("Row 3:", rows[3])
        }

    } catch (e: any) {
        console.log("Error:", e.message)
    }
}

debugCF()
