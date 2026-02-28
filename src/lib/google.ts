import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

function getGoogleAuth() {
    let customPrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';

    // Next.js prioritizes host shell variables. If the user's terminal has an improperly escaped export, 
    // it will truncate the key. We detect this and forcefully read from the physical .env.local file.
    if (customPrivateKey.length < 100) {
        try {
            const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
            const match = envContent.match(/GOOGLE_PRIVATE_KEY="([\s\S]*?)"/);
            if (match && match[1]) {
                customPrivateKey = match[1];
            }
        } catch (error) {
            console.error("Failed to read fallback private key from .env.local");
        }
    }

    // Vercel sometimes wraps env strings in literal quotes and double-escapes newlines
    try {
        // First try to parse it if it's literally stringified JSON
        if (customPrivateKey.startsWith('"') && customPrivateKey.endsWith('"')) {
            customPrivateKey = JSON.parse(customPrivateKey);
        }
    } catch (e) {
        // Fallback to manual stripping
        if (customPrivateKey.startsWith('"') && customPrivateKey.endsWith('"')) {
            customPrivateKey = customPrivateKey.slice(1, -1);
        }
    }

    // Ensure all literal escaped \n are true newlines for OpenSSL 3.0
    customPrivateKey = customPrivateKey.replace(/\\n/g, '\n');

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
