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

const parseEuropeanNumberHelper = (str) => {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    let clean = String(str).trim();
    if (clean === '-' || clean === '') return 0;
    clean = clean.replace(/€/g, '').replace(/\s/g, '');
    const hasComma = clean.includes(',');
    const hasPeriod = clean.includes('.');
    if (hasPeriod && hasComma) {
        if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            clean = clean.replace(/,/g, '');
        }
    } else if (hasComma) {
        clean = clean.replace(',', '.');
    }
    return parseFloat(clean) || 0;
};

async function inspect() {
    try {
        const fileResponse = await driveClient.files.get(
            { fileId: spreadsheetId, alt: 'media', supportsAllDrives: true },
            { responseType: 'arraybuffer' }
        );
        const workbook = xlsx.read(Buffer.from(fileResponse.data), { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const validRows = rows.slice(1).filter(r => r && r[0] && String(r[0]).trim() !== '');

        let runningBalance = 0;
        let diffFound = false;

        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            const balStr = String(row[5] || '');
            const inc = parseEuropeanNumberHelper(row[3]) || 0;
            const out = parseEuropeanNumberHelper(row[4]) || 0;
            const rawCellBalance = parseEuropeanNumberHelper(balStr);

            if (i === 0) {
                runningBalance = !isNaN(rawCellBalance) && balStr.trim() !== '' && !balStr.includes('[object')
                    ? rawCellBalance
                    : inc - Math.abs(out);
            } else {
                runningBalance = runningBalance + inc - Math.abs(out);
            }

            if (balStr.trim() !== '' && !balStr.includes('[object')) {
                const diff = Math.abs(runningBalance - rawCellBalance);
                if (diff > 0.01) {
                    console.log(`Mismatch at row ${i} (Date: ${row[0]}): Calculated ${runningBalance.toFixed(2)}, Cell ${rawCellBalance.toFixed(2)}`);
                    diffFound = true;
                }
            }
        }

        console.log(`Final Calculated Balance: ${runningBalance.toFixed(2)}`);

    } catch (e) {
        console.error("Test Error:", e);
    }
}
inspect();
