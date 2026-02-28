import { google } from 'googleapis';
import fs from 'fs';

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
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

async function testAppend() {
    try {
        const response = await drive.files.list({
            q: "name = 'Merged_finance.xlsx' and trashed = false",
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });
        const fileId = response.data.files[0]?.id;
        if (!fileId) throw new Error("File not found");
        console.log("File ID:", fileId);

        const appendRes = await sheets.spreadsheets.values.append({
            spreadsheetId: fileId,
            range: 'A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['TEST APPEND', 'IGNORE']]
            }
        });
        console.log("SUCCESS!", appendRes.data);
    } catch (e) {
        console.error("FAIL:", e.message);
    }
}
testAppend();
