import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { driveClient } from '@/lib/google'
import { appendEmployeeWorkToSheet } from '@/lib/google-sheets'
import { Readable } from 'stream'

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const employeeName = formData.get('employeeName') as string
        const date = formData.get('date') as string
        const hours = parseFloat(formData.get('hours') as string) || 0
        const payRate = parseFloat(formData.get('payRate') as string) || 0
        const extraCosts = parseFloat(formData.get('extraCosts') as string) || 0
        const projectNumber = formData.get('projectNumber') as string
        const description = formData.get('description') as string
        const file = formData.get('file') as File | null

        if (!employeeName || !date || hours <= 0 || payRate <= 0) {
            return NextResponse.json({ error: 'Missing required employee work fields' }, { status: 400 })
        }

        let driveFileId = null
        let driveFileLink = null

        // 1. Upload File to Google Drive if present
        if (file && file.size > 0) {
            const arrayBuffer = await file.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            const stream = new Readable()
            stream.push(buffer)
            stream.push(null)

            const driveFolderId = '1NJ37mPhzviW9CUtggSJOovPP2Dgz2JOX' // Specifically provided by user

            console.log(`[Employee Work Save] Uploading ${file.name} to Employees Drive folder...`)

            const uploadedFile = await driveClient.files.create({
                requestBody: {
                    name: `EMP_${employeeName}_${date}_${projectNumber || 'NoProj'}_${file.name}`,
                    parents: [driveFolderId],
                },
                media: {
                    mimeType: file.type,
                    body: stream
                },
                fields: 'id, webViewLink',
                supportsAllDrives: true
            })

            driveFileId = uploadedFile.data.id
            driveFileLink = uploadedFile.data.webViewLink

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

        // 2. Parse Date
        let parsedDate = new Date()
        if (date) {
            const parts = date.split('.')
            if (parts.length === 3) {
                parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
            }
        }

        // 3. Save to PostgreSQL
        console.log(`[Employee Work Save] Saving to Postgres for ${employeeName}`)
        const workRecord = await prisma.employeeWork.create({
            data: {
                employeeName,
                date: parsedDate,
                hours,
                payRate,
                extraCosts,
                projectNumber: projectNumber || null,
                description: description || null,
                driveFileId,
                driveFileLink
            }
        })

        // 4. Append to Excel
        try {
            await appendEmployeeWorkToSheet({
                employeeName,
                date: parsedDate,
                hours,
                payRate,
                extraCosts,
                projectNumber,
                description,
                driveFileLink: driveFileLink || null
            })
            console.log(`[Employee Work Save] Appended to Google Sheets Employees tab`)
        } catch (excelErr) {
            console.error("[Employee Work Save] Excel Append failed:", excelErr)
        }

        return NextResponse.json({ success: true, data: workRecord })

    } catch (error: any) {
        console.error('[Employee Work Save] Fatal Error:', error)
        return NextResponse.json({ error: error.message || 'Failed to save employee work' }, { status: 500 })
    }
}
