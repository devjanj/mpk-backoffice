import { google } from 'googleapis';

function getGoogleAuth() {
    const customPrivateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!customPrivateKey || !process.env.GOOGLE_CLIENT_EMAIL) {
        throw new Error('Google Cloud credentials missing from environment variables');
    }

    return new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: customPrivateKey,
        },
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive',
        ],
    });
}

// Reusable Google Sheets client
export const sheetsClient = google.sheets({
    version: 'v4',
    auth: getGoogleAuth(),
});

// Reusable Google Drive client
export const driveClient = google.drive({
    version: 'v3',
    auth: getGoogleAuth(),
});
