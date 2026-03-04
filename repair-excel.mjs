import { google } from 'googleapis';
import fs from 'fs';
import * as xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';

let customPrivateKey = '';
const envContent = fs.readFileSync('.env.local', 'utf-8');
const matchKey = envContent.match(/GOOGLE_PRIVATE_KEY="([\s\S]*?)"/);
if (matchKey) customPrivateKey = matchKey[1];
const matchEmail = envContent.match(/GOOGLE_CLIENT_EMAIL="([\s\S]*?)"/);
const clientEmail = matchEmail ? matchEmail[1] : '';

customPrivateKey = customPrivateKey.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: customPrivateKey },
    scopes: ['https://www.googleapis.com/auth/drive'],
});
const driveClient = google.drive({ version: 'v3', auth });

async function repairCFAndFixFormulas() {
    try {
        console.log("Connecting to Drive...");
        const response = await driveClient.files.list({
            q: "name = 'Merged_finance.xlsx' and trashed = false",
            fields: 'files(id, name)', supportsAllDrives: true, includeItemsFromAllDrives: true
        });
        const spreadsheetId = response.data.files[0]?.id;

        const fileResponse = await driveClient.files.get(
            { fileId: spreadsheetId, alt: 'media', supportsAllDrives: true },
            { responseType: 'arraybuffer' }
        );

        console.log("Loading Workbook...");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileResponse.data);

        const sheet = workbook.getWorksheet('CF');
        if (!sheet) throw new Error("CF sheet not found");

        console.log("Locating Header...");
        let headerRowIdx = -1;
        // Search rows 1 to 10 for the header "MESEC"
        for (let i = 1; i <= 10; i++) {
            const row = sheet.getRow(i);
            const colA = String(row.getCell(1).value || '').trim();
            if (colA === 'MESEC') {
                headerRowIdx = i;
                break;
            }
        }

        console.log("Header Found at Row:", headerRowIdx); // Should be 4

        // Extract the misplaced invoices above the header
        const misplacedRows = [];
        for (let i = 2; i < headerRowIdx; i++) {
            const row = sheet.getRow(i);
            // Must have data to keep
            if (row.getCell(3).value) {
                // Collect values manually because row.values includes undefined holes and formulas map weirdly
                const vals = [];
                for (let c = 1; c <= 10; c++) {
                    vals.push(row.getCell(c).value);
                }
                misplacedRows.push(vals);
            }
        }
        console.log("Found Misplaced Rows:", misplacedRows.length);

        // Delete the misplaced rows from the top which naturally shifts the Header back to Row 2
        if (headerRowIdx > 2) {
            console.log(`Deleting ${headerRowIdx - 2} rows from index 2`);
            sheet.spliceRows(2, headerRowIdx - 2);
        }

        // Find the True Bottom of the CF array by scanning the DATE column (C / 3)
        let trueBottom = 2; // Default to Header
        for (let i = sheet.rowCount; i >= 1; i--) {
            const row = sheet.getRow(i);
            const dateCell = row.getCell(3).value; // CF uses column C for date
            if (dateCell !== null && dateCell !== undefined && String(dateCell).trim() !== '') {
                trueBottom = i;
                break;
            }
        }

        console.log("True Bottom (after shift):", trueBottom);

        // Append misplaced rows to the bottom
        for (const rVals of misplacedRows) {
            trueBottom++;
            const newRow = sheet.getRow(trueBottom);
            // Map values
            for (let c = 1; c <= 10; c++) {
                // Formula for balance (G = 7) overrides previous explicitly
                if (c === 7) {
                    newRow.getCell(c).value = { formula: `G${trueBottom - 1}+E${trueBottom}-F${trueBottom}` };
                } else {
                    newRow.getCell(c).value = rVals[c - 1];
                }
            }
            newRow.commit();
        }

        // Recalculate ALL Balance Formulas in Column G downwards starting from row 3 (first data row)
        // Row 2 is the header
        console.log("Recalculating Balance Formulas from Row 3 to Row", trueBottom);
        for (let i = 3; i <= trueBottom; i++) {
            const row = sheet.getRow(i);

            // Re-apply explicit dynamic formulas to repair propagation
            // Formula is: Previous Balance (G) + Current Income (E) - Current Outcome (F)
            // Example: G3 = G2 + E3 - F3. Note G2 is string 'STANJE', but Excel treats E3-F3 if G2 is string
            // Actually, if i=3, G2 is a string, so we should just use E3-F3, but we can do G2+E3-F3 and let excel engine handle it,
            // Or explicitly:

            let formulaStr = ``;
            if (i === 3) {
                formulaStr = `E3-F3`; // G2 is text header "STANJE"
            } else {
                formulaStr = `G${i - 1}+E${i}-F${i}`;
            }

            row.getCell(7).value = { formula: formulaStr };
            row.commit();
        }

        console.log("Writing repaired sheet to buffer...");
        const newBuffer = await workbook.xlsx.writeBuffer();
        const stream = new Readable();
        stream.push(Buffer.from(newBuffer));
        stream.push(null);

        console.log("Uploading via Google Drive API...");
        await driveClient.files.update({
            fileId: spreadsheetId,
            media: {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                body: stream
            },
            supportsAllDrives: true
        });

        console.log("SUCCESS! Google Sheet CF Tab is repaired.");

    } catch (e) {
        console.error("Fatal exception during script execution:", e);
    }
}
repairCFAndFixFormulas();
