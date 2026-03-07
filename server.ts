import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Readable } from 'stream';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We elegantly reuse the exact same Prisma and Google connections from the Next.js Mono-repo
import prisma from './src/lib/prisma';
import { driveClient } from './src/lib/google';
import { appendInvoiceToSheet, appendEmployeeWorkToSheet, updateEmployeeWorkInSheet } from './src/lib/google-sheets';
import { parseEuropeanNumberHelper } from './src/lib/xml-parser';

const app = express();
app.use(cors());
app.use(express.json());

// Natively accept massive 50MB payloads bypassing Vercel limits
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ----------------------------------------------------------------------
// 1. INVOICE OCR UPLOAD ENDPOINT
// ----------------------------------------------------------------------
app.post('/api/invoice/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        console.log(`[Express OCR] Incoming file: ${req.file.originalname} (${req.file.mimetype})`);

        const base64Data = req.file.buffer.toString('base64');
        let mimeType = req.file.mimetype;
        if (req.file.originalname.toLowerCase().endsWith('.pdf')) {
            mimeType = 'application/pdf';
        }

        const prompt = `
            You are a highly accurate, structured data extraction engine operating for a carpentry business backoffice.
            Below is an image/PDF of an invoice or receipt.
            Please extract the following information. Be as accurate as possible. If a value is not explicitly found, return an empty string for text, or 0 for numbers.
            
            Strictly return ONLY a raw JSON object (do not wrap it in markdown block quotes like \`\`\`json) with the exact structure:
            {
                "amount": <number> (the total amount, e.g. 150.50),
                "tax": <number> (the tax amount, e.g. 33.11. If 0, return 0),
                "date": "<string>" (format strictly as DD.MM.YYYY),
                "description": "<string>" (A summarized description of the vendor/company and short list of items - max 60 chars)
            }
        `;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            }
        ]);

        const responseText = result.response.text();
        console.log(`[Express OCR] Raw AI Response:`, responseText);

        const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

        let extractedData = { amount: 0, tax: 0, date: '', description: '' };
        try { extractedData = JSON.parse(cleanedText); } catch (e) { }

        return res.json({ success: true, data: extractedData });
    } catch (error: any) {
        console.error('[Express OCR] Extraction Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to process file' });
    }
});

// ----------------------------------------------------------------------
// 2. INVOICE SAVE ENDPOINT
// ----------------------------------------------------------------------
app.post('/api/invoice/save', upload.single('file'), async (req, res) => {
    try {
        const file = req.file; // Multer format
        const { source, transactionType, date, projectNum: projectNumber, amount, tax, description, shortDescription } = req.body;

        if (!source || !amount || !description) {
            return res.status(400).json({ error: 'Missing required invoice fields' });
        }

        let driveFileId = null;
        let driveFileLink = null;

        if (file) {
            const stream = new Readable();
            stream.push(file.buffer);
            stream.push(null);

            const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
            if (!driveFolderId) return res.status(500).json({ error: 'Google Drive folder ID not configured in .env' });

            console.log(`[Express Invoice] Uploading ${file.originalname} to Google Drive`);

            let year = 'YYYY', month = 'MM', day = 'DD';
            if (date) {
                const parts = date.split('.');
                if (parts.length === 3) {
                    day = parts[0].padStart(2, '0');
                    month = parts[1].padStart(2, '0');
                    year = parts[2];
                }
            }

            const extensionMatch = file.originalname.match(/\.[^/.]+$/);
            const extension = extensionMatch ? extensionMatch[0] : '';
            const baseName = file.originalname.replace(/\.[^/.]+$/, '');
            const safeBaseName = baseName.replace(/[/\\\\?%*:|"<>]/g, '-');
            const newFileName = `${year}_${month}_${day}_${safeBaseName}_${source}${extension}`;

            const uploadedFile = await driveClient.files.create({
                requestBody: {
                    name: newFileName,
                    parents: [driveFolderId],
                },
                media: {
                    mimeType: file.mimetype,
                    body: stream
                },
                fields: 'id, webViewLink',
                supportsAllDrives: true
            });

            driveFileId = uploadedFile.data?.id;
            driveFileLink = uploadedFile.data?.webViewLink;

            if (driveFileId) {
                await driveClient.permissions.create({
                    fileId: driveFileId,
                    requestBody: { role: 'reader', type: 'anyone' },
                    supportsAllDrives: true
                });
            }
        }

        const rawAmount = parseEuropeanNumberHelper(amount) || 0;
        const parsedAmount = transactionType === 'INCOME' ? Math.abs(rawAmount) : -Math.abs(rawAmount);
        const parsedTax = parseEuropeanNumberHelper(tax) || 0;

        let parsedDate = new Date();
        if (date) {
            const parts = date.split('.');
            if (parts.length === 3) {
                parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
        }

        console.log(`[Express Invoice] Writing unified record to PostgreSQL -> ${source}`);
        const invoiceRecord = await prisma.invoice.create({
            data: {
                source: source,
                projectNumber: projectNumber || 'N/A',
                description: description,
                amount: parsedAmount,
                taxAmount: parsedTax,
                type: parsedAmount >= 0 ? 'INCOME' : 'OUTCOME',
                date: parsedDate,
                driveFileId: driveFileId,
                driveFileLink: driveFileLink
            }
        });

        try {
            await appendInvoiceToSheet({
                source, date, projectNumber, description, shortDescription, parsedAmount, driveFileLink: driveFileLink || null
            });
            console.log(`[Express Invoice] Appended to Google Sheets -> ${source}`);
        } catch (excelErr) {
            console.error("[Express Invoice] Excel Append failed:", excelErr);
        }

        return res.json({ success: true, data: invoiceRecord });

    } catch (error: any) {
        console.error('[Express Invoice] Fatal Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to save invoice' });
    }
});

// ----------------------------------------------------------------------
// 3. EMPLOYEE WORK SAVE ENDPOINT (Multi-file)
// ----------------------------------------------------------------------
app.post('/api/employees/work', upload.array('file'), async (req, res) => {
    try {
        const files = req.files as Express.Multer.File[];
        const { id, employeeName, date, payRate: rawPayRate, extraCosts: rawExtraCosts, description, allocations: rawAllocations } = req.body;

        let allocations: { projectNumber: string, hours: number }[] = [];
        try {
            if (rawAllocations) allocations = JSON.parse(rawAllocations);
        } catch (e) { }

        const hours = allocations.reduce((sum, alloc) => sum + (alloc.hours || 0), 0);
        const aggregatedProjectString = allocations.length > 0
            ? allocations.map(a => `${a.projectNumber} (${a.hours}h)`).join(', ')
            : '-';

        const payRate = parseEuropeanNumberHelper(rawPayRate) || 0;
        const extraCosts = parseEuropeanNumberHelper(rawExtraCosts) || 0;

        if (!employeeName || !date || hours <= 0 || payRate <= 0) {
            return res.status(400).json({ error: 'Missing required employee work fields.' });
        }

        let parsedDate = new Date();
        if (date) {
            const parts = date.split('.');
            if (parts.length === 3) parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }

        let driveFileId: string | null = null;
        let driveFileLink: string | null = null;
        let existingRecord = null;

        if (id) {
            existingRecord = await prisma.employeeWork.findUnique({ where: { id } });
            if (!existingRecord) return res.status(404).json({ error: 'Record not found for editing.' });
            driveFileId = existingRecord.driveFileId;
            driveFileLink = existingRecord.driveFileLink;
        }

        const uploadedFileIds: string[] = [];

        if (files && files.length > 0) {
            const parentDriveFolderId = '1NJ37mPhzviW9CUtggSJOovPP2Dgz2JOX';

            const dParts = date.split('.');
            const safeDateFolder = dParts.length === 3 ? `${parseInt(dParts[0])}-${parseInt(dParts[1])}-${dParts[2]}` : date.replace(/\\./g, '-');
            const targetFolderName = `${employeeName}-${safeDateFolder}`;

            const searchRes = await driveClient.files.list({
                q: `mimeType='application/vnd.google-apps.folder' and name='${targetFolderName}' and '${parentDriveFolderId}' in parents and trashed=false`,
                fields: 'files(id, name, webViewLink)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
            });

            let uploadFolderId = searchRes.data.files && searchRes.data.files.length > 0 ? searchRes.data.files[0].id : null;
            let uploadFolderLink = searchRes.data.files && searchRes.data.files.length > 0 ? searchRes.data.files[0].webViewLink : null;

            if (!uploadFolderId) {
                const folderCreateRes = await driveClient.files.create({
                    requestBody: { name: targetFolderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentDriveFolderId] },
                    fields: 'id, webViewLink',
                    supportsAllDrives: true
                });
                uploadFolderId = folderCreateRes.data?.id || null;
                uploadFolderLink = folderCreateRes.data?.webViewLink || null;

                if (uploadFolderId) {
                    try {
                        await driveClient.permissions.create({
                            fileId: uploadFolderId,
                            requestBody: { role: 'reader', type: 'anyone' },
                            supportsAllDrives: true
                        });
                    } catch (permErr: any) { }
                }
            }

            for (const file of files) {
                if (file.size === 0) continue;

                const stream = new Readable();
                stream.push(file.buffer);
                stream.push(null);

                const uploadedFile = await driveClient.files.create({
                    requestBody: {
                        name: `EMP_${employeeName}_${date}_${allocations[0]?.projectNumber || 'NoProj'}_${file.originalname}`,
                        parents: [uploadFolderId!],
                    },
                    media: { mimeType: file.mimetype || 'application/octet-stream', body: stream },
                    fields: 'id',
                    supportsAllDrives: true
                });

                if (uploadedFile.data?.id) {
                    uploadedFileIds.push(uploadedFile.data.id);
                    try {
                        await driveClient.permissions.create({
                            fileId: uploadedFile.data.id,
                            requestBody: { role: 'reader', type: 'anyone' },
                            supportsAllDrives: true
                        });
                    } catch (permErr: any) { }
                }
            }

            if (id && existingRecord?.driveFileId) {
                const oldIds = existingRecord.driveFileId.split(',');
                for (const oldId of oldIds) {
                    if (oldId.trim()) {
                        try {
                            await driveClient.files.delete({ fileId: oldId.trim(), supportsAllDrives: true });
                        } catch (delErr) { }
                    }
                }
            }

            driveFileId = uploadedFileIds.length > 0 ? uploadedFileIds.join(',') : null;
            driveFileLink = uploadFolderLink || null;
        }

        if (id) {
            await prisma.employeeWorkAllocation.deleteMany({ where: { employeeWorkId: id } });

            const updatedRecord = await prisma.employeeWork.update({
                where: { id },
                data: {
                    employeeName, date: parsedDate, hours, payRate, extraCosts,
                    projectNumber: aggregatedProjectString, description: description || null,
                    driveFileId, driveFileLink,
                    allocations: { create: allocations.map(a => ({ projectNumber: a.projectNumber, hours: a.hours })) }
                }
            });

            try {
                await updateEmployeeWorkInSheet(id, {
                    employeeName, date: parsedDate, hours, payRate, extraCosts,
                    projectNumber: aggregatedProjectString, description, driveFileLink: driveFileLink || null
                });
            } catch (excelErr) { }

            return res.json({ success: true, data: updatedRecord });
        } else {
            const workRecord = await prisma.employeeWork.create({
                data: {
                    employeeName, date: parsedDate, hours, payRate, extraCosts,
                    projectNumber: aggregatedProjectString, description: description || null,
                    driveFileId, driveFileLink,
                    allocations: { create: allocations.map(a => ({ projectNumber: a.projectNumber, hours: a.hours })) }
                }
            });

            try {
                await appendEmployeeWorkToSheet({
                    id: workRecord.id, employeeName, date: parsedDate, hours, payRate, extraCosts,
                    projectNumber: aggregatedProjectString, description, driveFileLink: driveFileLink || null
                });
            } catch (excelErr) { }

            return res.json({ success: true, data: workRecord });
        }

    } catch (error: any) {
        console.error('[Express Employee Work] Fatal Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to save employee work' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Dedicated Droplet Express API running securely on port ${PORT}`);
});
