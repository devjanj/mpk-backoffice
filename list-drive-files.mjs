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
    credentials: { client_email: clientEmail, private_key: customPrivateKey },
    scopes: ['https://www.googleapis.com/auth/drive'],
});
const driveClient = google.drive({ version: 'v3', auth });

async function checkDrive() {
    try {
        console.log("Locating all 'finance' files...");
        const response = await driveClient.files.list({
            q: "name contains 'finance' or name contains 'Merged_finance' and trashed = false",
            fields: 'files(id, name, mimeType, webViewLink, modifiedTime, owners)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });
        
        const files = response.data.files;
        console.log(`Found ${files.length} files:`);
        files.forEach((f, i) => {
            console.log(`\n[${i+1}] Name: ${f.name}`);
            console.log(`    ID: ${f.id}`);
            console.log(`    Type: ${f.mimeType}`);
            console.log(`    Modified: ${f.modifiedTime}`);
            console.log(`    Link: ${f.webViewLink}`);
            console.log(`    Owners:`, f.owners?.map(o => o.emailAddress).join(', '));
        });
    } catch (e) {
        console.error("Test Error:", e);
    }
}
checkDrive();
