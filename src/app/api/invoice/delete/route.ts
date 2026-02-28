import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { driveClient } from '@/lib/google'
import { getSession } from '@/lib/session'
import { removeInvoiceFromSheet } from '@/lib/google-sheets'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
    try {
        const session = await getSession()
        if (!session?.authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { id, transactionUrl } = body

        if (!id && !transactionUrl) {
            return NextResponse.json({ error: 'Invoice ID or URL is required' }, { status: 400 })
        }

        // Fetch invoice to get driveFileId
        let invoice = null
        if (id && id.length > 20) { // rough check for CUID
            invoice = await prisma.invoice.findUnique({
                where: { id }
            })
        }

        let targetDriveId = invoice?.driveFileId

        if (!invoice && transactionUrl && transactionUrl.includes('drive.google.com')) {
            // Attempt to extract drive ID from UI url if it's an orphaned row
            const match = transactionUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
            if (match && match[1]) {
                targetDriveId = match[1]
            }
        }

        if (!invoice && !targetDriveId) {
            return NextResponse.json({ error: 'Invoice not found in DB and no valid Drive link provided' }, { status: 404 })
        }

        // Delete from Drive if possible
        if (targetDriveId) {
            try {
                await driveClient.files.delete({
                    fileId: targetDriveId,
                    supportsAllDrives: true
                })
                console.log(`[Invoice Delete] Successfully deleted file from Google Drive: ${targetDriveId}`)
            } catch (driveErr: any) {
                console.warn(`[Invoice Delete] Failed to delete from Google Drive (might already be deleted):`, driveErr.message)
            }
        }

        // Delete from Google Sheets
        if (targetDriveId) {
            try {
                await removeInvoiceFromSheet(targetDriveId)
                console.log(`[Invoice Delete] Successfully removed row from Merged_finance.xlsx`)
            } catch (sheetErr: any) {
                console.warn(`[Invoice Delete] Failed to remove from Google Sheets:`, sheetErr.message)
            }
        }

        // Delete from Postgres if it exists
        if (invoice) {
            await prisma.invoice.delete({
                where: { id: invoice.id }
            })
            console.log(`[Invoice Delete] Successfully deleted invoice ${invoice.id} from database`)
        } else {
            console.log(`[Invoice Delete] Orphaned sheet entry deleted via transactionUrl fallback`)
        }

        revalidatePath('/', 'layout')
        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('[Invoice Delete] Fatal Error:', error)
        return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
    }
}
