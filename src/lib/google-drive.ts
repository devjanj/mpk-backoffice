'use server'

import { driveClient } from '@/lib/google'

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID

export async function uploadInvoiceToDrive(fileBuffer: Buffer, fileName: string, mimeType: string) {
    if (!DRIVE_FOLDER_ID) throw new Error('GOOGLE_DRIVE_FOLDER_ID is missing from environment variables')

    try {
        // 1. Upload the file to Google Drive
        const response = await driveClient.files.create({
            requestBody: {
                name: fileName,
                parents: [DRIVE_FOLDER_ID],
            },
            media: {
                mimeType: mimeType,
                body: fileBuffer,
            },
            fields: 'id, webViewLink, webContentLink',
        });

        const fileId = response.data.id;

        if (!fileId) throw new Error('Failed to retrieve file ID from Google Drive')

        // 2. Make the file accessible to anyone with the link (or keep it restricted if you prefer)
        await driveClient.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        return {
            success: true,
            fileId: fileId,
            webViewLink: response.data.webViewLink,
        };
    } catch (error) {
        console.error('Error uploading file to Google Drive:', error);
        return { success: false, error: 'Failed to upload invoice to Drive' };
    }
}
