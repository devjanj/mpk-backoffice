import { google } from 'googleapis';
import fs from 'fs';

let customPrivateKey = '';
const envContent = fs.readFileSync('.env.local', 'utf-8');
const matchKey = envContent.match(/GOOGLE_PRIVATE_KEY="([\s\S]*?)"/);
if (matchKey) customPrivateKey = matchKey[1];
const matchEmail = envContent.match(/GOOGLE_CLIENT_EMAIL="([\s\S]*?)"/);
const clientEmail = matchEmail ? matchEmail[1] : '';
const matchFolder = envContent.match(/GOOGLE_DRIVE_FOLDER_ID="([\s\S]*?)"/);
const folderId = matchFolder ? matchFolder[1] : '';

customPrivateKey = customPrivateKey.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: clientEmail,
        private_key: customPrivateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function checkFolder() {
    try {
        const res = await drive.files.get({
            fileId: folderId,
            fields: 'id, name, driveId, teamDriveId, shared, ownedByMe',
            supportsAllDrives: true
        });
        console.log("FOLDER METADATA:");
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

checkFolder();
