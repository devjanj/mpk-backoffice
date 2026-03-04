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

async function checkCF() {
    try {
        const response = await driveClient.files.list({
            q: "name = 'Merged_finance.xlsx' and trashed = false",
            fields: 'files(id, name)', supportsAllDrives: true, includeItemsFromAllDrives: true
        });
        const spreadsheetId = response.data.files[0]?.id;

        const fileResponse = await driveClient.files.get(
            { fileId: spreadsheetId, alt: 'media', supportsAllDrives: true },
            { responseType: 'arraybuffer' }
        );
        const workbook = xlsx.read(Buffer.from(fileResponse.data), { type: 'buffer' });
        const sheet = workbook.Sheets['CF'];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        console.log("CF Tab - First 15 rows:");
        for (let i = 0; i < 15 && i < rows.length; i++) {
            console.log(`Row ${i + 1}:`, rows[i]);
        }

    } catch (e) {
        console.error("Test Error:", e);
    }
}
checkCF();
