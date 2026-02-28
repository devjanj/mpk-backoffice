import { google } from 'googleapis';
import fs from 'fs';
import * as xlsx from 'xlsx';

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

async function insertDemo() {
    try {
        console.log("Locating file...");
        const response = await driveClient.files.list({
            q: "name = 'Merged_finance.xlsx' and trashed = false",
            fields: 'files(id, name)', supportsAllDrives: true, includeItemsFromAllDrives: true
        });
        const spreadsheetId = response.data.files[0]?.id;
        if (!spreadsheetId) throw new Error("File not found");

        console.log("Downloading buffer...");
        const fileResponse = await driveClient.files.get(
            { fileId: spreadsheetId, alt: 'media', supportsAllDrives: true },
            { responseType: 'arraybuffer' }
        );
        const workbook = xlsx.read(Buffer.from(fileResponse.data), { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        console.log("Initial Rows:", rows.length);
        
        // Find true last row by looking for a valid date string (e.g. 24.02.2026) or a month number (e.g. 1.25 for CF)
        let insertIndex = rows.length
        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i]
            if (row && row.length > 0) {
                const colA = String(row[0]).trim()
                // If it looks like a number, a date, or month.year notation
                if (colA !== '' && !colA.startsWith('=')) { 
                    // Let's print out what we see
                    console.log(`Row ${i} Col A:`, colA, "Length:", colA.length);
                    // We only want to break when we hit genuine data
                    if (colA.length > 2) {
                         insertIndex = i + 1
                         break
                    }
                }
            }
        }
        
        console.log("Identified Insert Index:", insertIndex);
    } catch (e) {
        console.error("Test Error:", e);
    }
}
insertDemo();
