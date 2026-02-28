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
    credentials: {
        client_email: clientEmail,
        private_key: customPrivateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function checkSheets() {
    try {
        const response = await drive.files.list({
            q: "name = 'Merged_finance.xlsx' and trashed = false",
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });
        const fileId = response.data.files[0]?.id;
        if (!fileId) throw new Error("File not found");

        const fileRes = await drive.files.get(
            { fileId, alt: 'media', supportsAllDrives: true },
            { responseType: 'arraybuffer' }
        );

        const fileBuffer = Buffer.from(fileRes.data);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        console.log("Sheet names:", workbook.SheetNames);

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`Total rows in ${workbook.SheetNames[0]}:`, rows.length);
        console.log("Last 2 rows:", rows.slice(-2));

        const cfSheet = workbook.Sheets['CF'];
        if (cfSheet) {
            const cfRows = xlsx.utils.sheet_to_json(cfSheet, { header: 1 });
            console.log("Total rows in CF:", cfRows.length);
            console.log("Last CF row:", cfRows.slice(-1));
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
checkSheets();
