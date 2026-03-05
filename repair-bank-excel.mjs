import { google } from 'googleapis';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import { Readable } from 'stream';

dotenv.config({ path: '.env.local' });

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
});

async function main() {
    console.log("Connecting to Drive API for Bank Repair...")
    const driveClient = google.drive({ version: 'v3', auth });

    const fileId = process.env.GOOGLE_SHEET_ID;

    // Download
    const response = await driveClient.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(response.data));

    let bankSheetName = 'Merged Finance Ledger';
    let sheet = workbook.getWorksheet(bankSheetName);

    if (!sheet) {
        console.log("No Bank/Merged sheet found.");
        return;
    }

    console.log(`Initial Bank sheet rows: ${sheet.rowCount}`);

    let trueBottom = sheet.rowCount;
    for (let i = sheet.rowCount; i >= 1; i--) {
        const row = sheet.getRow(i)
        // Check Date, Description, Income, and Outcome
        const colA = String(row.getCell(1).value || '').trim()
        const colC = String(row.getCell(3).value || '').trim()
        const colD = String(row.getCell(4).value || '').trim()
        const colF = String(row.getCell(6).value || '').trim()

        const hasData = [colA, colC, colD, colF].some(val =>
            val !== '' && val !== 'null' && val !== 'undefined' && val !== '-'
        );

        if (hasData) {
            trueBottom = i;
            break;
        }
    }

    console.log(`True data bottom located at row: ${trueBottom}`);
    console.log("Recalculating ALL Balance formulas from Row 2 down to the bottom...");

    for (let i = 2; i <= trueBottom; i++) {
        const thisRow = sheet.getRow(i);
        const prevRowIndex = i - 1;

        const prevExists = i > 2; // Row 1 is text header
        thisRow.getCell(6).value = prevExists
            ? { formula: `F${prevRowIndex}+D${i}-E${i}` }
            : { formula: `D${i}-E${i}` };
    }

    console.log("Mathematical link rebuilt.");

    console.log(`Row 400 formula:`, JSON.stringify(sheet.getRow(400).getCell(6).value));
    console.log(`Row ${trueBottom} formula:`, JSON.stringify(sheet.getRow(trueBottom).getCell(6).value));

    console.log("Uploading to Google Drive...");

    const newBuffer = await workbook.xlsx.writeBuffer();
    const stream = new Readable();
    stream.push(Buffer.from(newBuffer));
    stream.push(null);

    await driveClient.files.update({
        fileId,
        supportsAllDrives: true,
        media: {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            body: stream
        }
    });

    console.log("Bank sheet fully repaired and updated live in the cloud!");
}
main().catch(console.error);
