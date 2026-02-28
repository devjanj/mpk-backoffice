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

async function inspect() {
    try {
        const fileResponse = await driveClient.files.get(
            { fileId: spreadsheetId, alt: 'media', supportsAllDrives: true },
            { responseType: 'arraybuffer' }
        );
        const workbook = xlsx.read(Buffer.from(fileResponse.data), { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const validRows = rows.filter(r => r.length >= 6 && r[0] && String(r[0]).trim() !== '');
        
        console.log("Last 5 valid rows:");
        for(let i=Math.max(0, validRows.length - 5); i<validRows.length; i++) {
           const row = validRows[i];
           console.log(`Date: ${row[0]}, Income: ${row[3]}, Outcome: ${row[4]}, Balance: ${row[5]}`);
        }
    } catch (e) {
        console.error("Test Error:", e);
    }
}
inspect();
