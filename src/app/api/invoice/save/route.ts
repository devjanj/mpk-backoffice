import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { driveClient } from '@/lib/google'
import { appendInvoiceToSheet } from '@/lib/google-sheets'
import { Readable } from 'stream'
import { parseEuropeanNumberHelper } from '@/lib/xml-parser'

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const source = formData.get('source') as string // 'BANK' or 'CF'
        const date = formData.get('date') as string
        const projectNumber = formData.get('projectNum') as string
        const amount = formData.get('amount') as string
        const tax = formData.get('tax') as string
        const description = formData.get('description') as string
        const shortDescription = formData.get('shortDescription') as string

        if (!source || !amount || !description) {
            return NextResponse.json({ error: 'Missing required invoice fields' }, { status: 400 })
        }

        let driveFileId = null
        let driveFileLink = null

        // 1. Upload File to Google Drive if present
        if (file) {
            const arrayBuffer = await file.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            // Convert Buffer to a Readable stream for Googleapi ingestion
            const stream = new Readable()
            stream.push(buffer)
            stream.push(null)

            const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID

            if (!driveFolderId) {
                return NextResponse.json({ error: 'Google Drive folder ID not configured in .env' }, { status: 500 })
            }

            console.log(`[Invoice Save] Uploading ${file.name} to Google Drive folder: ${driveFolderId}`)

            const uploadedFile = await driveClient.files.create({
                requestBody: {
                    name: `MPK_${source}_${date}_${projectNumber || 'NoProj'}_${file.name}`,
                    parents: [driveFolderId], // Put it in the main finance folder for now. User can organize later.
                },
                media: {
                    mimeType: file.type,
                    body: stream
                },
                fields: 'id, webViewLink, webContentLink',
                supportsAllDrives: true
            })

            driveFileId = uploadedFile.data.id
            driveFileLink = uploadedFile.data.webViewLink

            console.log(`[Invoice Save] Upload successful! Drive ID: ${driveFileId}`)

            // Set public permissions so the user can click the link and view it instantly without logging in
            if (driveFileId) {
                await driveClient.permissions.create({
                    fileId: driveFileId,
                    requestBody: {
                        role: 'reader',
                        type: 'anyone',
                    },
                    supportsAllDrives: true
                })
            }
        }

        // 2. Parse Numeric Values securely (force invoices as negative outcome)
        // Uses European parsing since frontend or AI might send "1.442,13"
        const rawAmount = parseEuropeanNumberHelper(amount)
        const parsedAmount = -Math.abs(rawAmount || 0)

        const parsedTax = parseEuropeanNumberHelper(tax) || 0

        // Convert DD.MM.YYYY String to native DateTime for Prisma sortability
        let parsedDate = new Date()
        if (date) {
            const parts = date.split('.')
            if (parts.length === 3) {
                parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
            }
        }

        // 3. Save Structured Data to PostgreSQL
        console.log(`[Invoice Save] Writing unified record to PostgreSQL Prisma -> ${source}`)
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
        })

        // 4. Append to Excel
        try {
            await appendInvoiceToSheet({
                source,
                date,
                projectNumber,
                description,
                shortDescription,
                parsedAmount,
                driveFileLink: driveFileLink || null
            })
            console.log(`[Invoice Save] Appended to Google Sheets -> ${source}`)
        } catch (excelErr) {
            console.error("[Invoice Save] Excel Append failed:", excelErr)
            // Continue processing and return success since DB & Drive succeeded
        }

        return NextResponse.json({ success: true, data: invoiceRecord })

    } catch (error: any) {
        console.error('[Invoice Save] Fatal Error:', error)
        return NextResponse.json({ error: error.message || 'Failed to save invoice context and file to Drive' }, { status: 500 })
    }
}
