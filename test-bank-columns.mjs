import { google } from 'googleapis';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import { Readable } from 'stream';

dotenv.config({ path: '.env.local' });

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
});

async function main() {
    console.log("Connecting to Drive API...")
    const driveClient = google.drive({ version: 'v3', auth });
    
    // In src/lib/google-sheets.ts it uses:
    // const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    // const driveFileId = process.env.GOOGLE_DRIVE_FOLDER_ID; // Wait, that's a folder ID.
    // Let's check what src/lib/google-sheets.ts actually downloads.
    
    const fileId = process.env.GOOGLE_SHEET_ID;
    
    // Download
    const response = await driveClient.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
    );
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(response.data));
    
    console.log("Available sheets in workbook:");
    workbook.eachSheet((s) => {
        console.log(`- '${s.name}' (ID: ${s.id})`);
    });
}
main().catch(console.error);
