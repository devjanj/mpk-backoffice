import { google } from 'googleapis';
import fs from 'fs';
import * as xlsx from 'xlsx';

let customPrivateKey = '';
const envContent = fs.readFileSync('.env.local', 'utf-8');
const matchKey = envContent.match(/GOOGLE_PRIVATE_KEY="([\s\S]*?)"/);
if (matchKey) customPrivateKey = matchKey[1];
const matchEmail = envContent.match(/GOOGLE_CLIENT_EMAIL="([\s\S]*?)"/);
const clientEmail = matchEmail ? matchEmail[1] : '';
const matchSheet = envContent.match(/GOOGLE_SHEET_ID="([\s\S]*?)"/);
const spreadsheetId = matchSheet ? matchSheet[1] : '';

customPrivateKey = customPrivateKey.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: customPrivateKey },
    scopes: ['https://www.googleapis.com/auth/drive'],
});
const driveClient = google.drive({ version: 'v3', auth });

async function inspectRow80() {
    try {
        const fileResponse = await driveClient.files.get(
            { fileId: spreadsheetId, alt: 'media', supportsAllDrives: true },
            { responseType: 'arraybuffer' }
        );
        const workbook = xlsx.read(Buffer.from(fileResponse.data), { type: 'buffer' });

        const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('cf')) || workbook.SheetNames[1];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        console.log("CF Sheet Raw Rows 75-85:");
        for (let i = 75; i <= 85; i++) {
            console.log(`Row index ${i}:`, rows[i]);
        }

    } catch (e) {
        console.error("Test Error:", e);
    }
}
inspectRow80();
