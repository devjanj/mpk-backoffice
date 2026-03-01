import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { driveClient } from '@/lib/google'
import { removeEmployeeWorkFromSheet } from '@/lib/google-sheets'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { id, driveFileLink } = body

        if (!id) {
            return NextResponse.json({ error: 'Missing employee work ID' }, { status: 400 })
        }

        // 1. Find the record in the DB to extract the driveFileId
        const workRecord = await prisma.employeeWork.findUnique({
            where: { id }
        })

        if (!workRecord) {
            return NextResponse.json({ error: 'Record not found in database' }, { status: 404 })
        }

        // 2. Delete the record from PostgreSQL Database
        await prisma.employeeWork.delete({
            where: { id }
        })
        console.log(`[Employee Work Delete] Removed Postgres footprint for: ${id}`)

        // 3. Delete Physical Files from Google Drive iteratively
        if (workRecord.driveFileId) {
            const fileIds = workRecord.driveFileId.split(',')
            for (const fId of fileIds) {
                if (fId.trim()) {
                    try {
                        console.log(`[Employee Work Delete] Deleting physical file from Drive: ${fId}`)
                        await driveClient.files.delete({ fileId: fId.trim(), supportsAllDrives: true })
                    } catch (driveErr: any) {
                        console.error("[Employee Work Delete] Failed to delete file or file already removed:", driveErr.message)
                    }
                }
            }
        }

        // 4. Remove the row from Google Sheets Excel File by its hidden Postgres ID
        try {
            await removeEmployeeWorkFromSheet(id)
            console.log(`[Employee Work Delete] Removed row from Google Sheets Employees tab`)
        } catch (sheetErr) {
            console.error("[Employee Work Delete] Failed to remove row from Google Sheet:", sheetErr)
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('[Employee Work Delete] Fatal Error:', error)
        return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
    }
}
