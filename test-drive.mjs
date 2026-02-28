import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

let customPrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';
if (customPrivateKey.startsWith('"') && customPrivateKey.endsWith('"')) {
    try { customPrivateKey = JSON.parse(customPrivateKey); } catch (e) { customPrivateKey = customPrivateKey.slice(1, -1); }
}
customPrivateKey = customPrivateKey.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: customPrivateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function checkFolder() {
    try {
        const res = await drive.files.get({
            fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
            fields: 'id, name, driveId, teamDriveId, shared, ownedByMe',
            supportsAllDrives: true
        });
        console.log("Folder Metadata:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

checkFolder();
