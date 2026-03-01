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

async function inspectCF() {
    try {
        const fileResponse = await driveClient.files.get(
            { fileId: spreadsheetId, alt: 'media', supportsAllDrives: true },
            { responseType: 'arraybuffer' }
        );
        const workbook = xlsx.read(Buffer.from(fileResponse.data), { type: 'buffer' });

        // CF is usually the second sheet
        const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('cf')) || workbook.SheetNames[1];
        if (!sheetName) {
            console.error("Could not find CF sheet");
            return;
        }

        console.log(`Using Sheet: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        // Filter out empty rows, same as syncCFSheet
        const validRows = rows.slice(1).filter(r => {
            const month = String(r[0] || '').trim();
            const date = String(r[2] || '').trim();
            const desc = String(r[3] || '').trim();
            const inc = String(r[4] || '').trim();
            const out = String(r[5] || '').trim();

            if (month.toLowerCase() === 'mesec' || date.toLowerCase() === 'datum' || date.toLowerCase() === 'date' || desc.toLowerCase() === 'description') return false;
            return date !== '' || desc !== '' || inc !== '' || out !== '';
        });

        console.log(`Found ${validRows.length} valid CF rows.`);

        let runningBalance = 0;
        let diffFound = false;

        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            const balStr = String(row[6] || '');
            const inc = parseEuropeanNumberHelper(row[4]) || 0;
            const out = parseEuropeanNumberHelper(row[5]) || 0;
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
                    console.log(`Mismatch at row ${i} (Data: ${row[2]} - ${row[3]}): Calculated ${runningBalance.toFixed(2)}, Cell ${rawCellBalance.toFixed(2)}`);
                    diffFound = true;
                }
            }
        }

        console.log(`Final Calculated Balance: ${runningBalance.toFixed(2)}`);

    } catch (e) {
        console.error("Test Error:", e);
    }
}
inspectCF();
