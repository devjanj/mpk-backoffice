import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { driveClient } from '@/lib/google'
import { appendEmployeeWorkToSheet } from '@/lib/google-sheets'
import { Readable } from 'stream'
import { parseEuropeanNumberHelper } from '@/lib/xml-parser'

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const employeeName = formData.get('employeeName') as string
        const date = formData.get('date') as string
        const rawHours = formData.get('hours') as string
        const rawPayRate = formData.get('payRate') as string
        const rawExtraCosts = formData.get('extraCosts') as string
        const projectNumber = formData.get('projectNumber') as string
        const description = formData.get('description') as string
        const file = formData.get('file') as File | null

        const hours = parseEuropeanNumberHelper(rawHours) || 0
        const payRate = parseEuropeanNumberHelper(rawPayRate) || 0
        const extraCosts = parseEuropeanNumberHelper(rawExtraCosts) || 0

        if (!employeeName || !date || hours <= 0 || payRate <= 0) {
            return NextResponse.json({ error: 'Missing required employee work fields. Hours and PayRate must be greater than 0.' }, { status: 400 })
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

            const parentDriveFolderId = '1NJ37mPhzviW9CUtggSJOovPP2Dgz2JOX' // Employees root

            // Reformat DD.MM.YYYY to D-M-YYYY for the folder name
            const dParts = date.split('.')
            const safeDateFolder = dParts.length === 3 ? `${parseInt(dParts[0])}-${parseInt(dParts[1])}-${dParts[2]}` : date.replace(/\./g, '-')
            const targetFolderName = `${employeeName}-${safeDateFolder}`

            console.log(`[Employee Work Save] Searching for subfolder: ${targetFolderName}`)

            // 1a. Search for existing subfolder
            const searchRes = await driveClient.files.list({
                q: `mimeType='application/vnd.google-apps.folder' and name='${targetFolderName}' and '${parentDriveFolderId}' in parents and trashed=false`,
                fields: 'files(id, name)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
            })

            let uploadFolderId = searchRes.data.files && searchRes.data.files.length > 0
                ? searchRes.data.files[0].id
                : null

            // 1b. Create subfolder if it doesn't exist
            if (!uploadFolderId) {
                console.log(`[Employee Work Save] Subfolder not found. Creating: ${targetFolderName}`)
                const folderCreateRes = await driveClient.files.create({
                    requestBody: {
                        name: targetFolderName,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [parentDriveFolderId]
                    },
                    fields: 'id',
                    supportsAllDrives: true
                })
                uploadFolderId = folderCreateRes.data.id

                // Set folder as highly visible immediately
                if (uploadFolderId) {
                    await driveClient.permissions.create({
                        fileId: uploadFolderId,
                        requestBody: { role: 'reader', type: 'anyone' },
                        supportsAllDrives: true
                    })
                }
            }

            console.log(`[Employee Work Save] Uploading ${file.name} to ${targetFolderName} (${uploadFolderId})...`)

            const uploadedFile = await driveClient.files.create({
                requestBody: {
                    name: `EMP_${employeeName}_${date}_${projectNumber || 'NoProj'}_${file.name}`,
                    parents: [uploadFolderId!],
                },
                media: {
                    mimeType: file.type || 'application/octet-stream',
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
