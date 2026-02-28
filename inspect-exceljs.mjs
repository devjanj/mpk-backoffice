import { google } from 'googleapis';
import fs from 'fs';
import ExcelJS from 'exceljs';

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
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(Buffer.from(fileResponse.data));
        const sheet = workbook.worksheets[0];
        
        console.log("Last 5 valid rows (A to F):");
        for(let i=Math.max(1, sheet.rowCount - 5); i<=sheet.rowCount; i++) {
           let row = sheet.getRow(i);
           if(row.getCell(1).value) {
               console.log("Row", i);
               console.log("A:", row.getCell(1).value);
               console.log("D:", row.getCell(4).value);
               console.log("E:", row.getCell(5).value);
               
               let fCell = row.getCell(6);
               console.log("F (type):", fCell.type);
               console.log("F (value):", fCell.value);
               if(fCell.type === ExcelJS.ValueType.Formula) {
                   console.log("   Formula:", fCell.formula);
                   console.log("   Result:", fCell.result);
               }
           }
        }
    } catch (e) {
        console.error("Test Error:", e);
    }
}
inspect();
