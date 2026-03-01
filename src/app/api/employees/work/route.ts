import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { driveClient } from '@/lib/google'
import { appendEmployeeWorkToSheet, updateEmployeeWorkInSheet } from '@/lib/google-sheets'
import { Readable } from 'stream'
import { parseEuropeanNumberHelper } from '@/lib/xml-parser'

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const id = formData.get('id') as string | null
        const employeeName = formData.get('employeeName') as string
        const date = formData.get('date') as string
        const rawHours = formData.get('hours') as string
        const rawPayRate = formData.get('payRate') as string
        const rawExtraCosts = formData.get('extraCosts') as string
        const projectNumber = formData.get('projectNumber') as string
        const description = formData.get('description') as string

        // Grab multiple files if they exist
        const files = formData.getAll('file') as File[]

        const hours = parseEuropeanNumberHelper(rawHours) || 0
        const payRate = parseEuropeanNumberHelper(rawPayRate) || 0
        const extraCosts = parseEuropeanNumberHelper(rawExtraCosts) || 0

        if (!employeeName || !date || hours <= 0 || payRate <= 0) {
            return NextResponse.json({ error: 'Missing required employee work fields. Hours and PayRate must be greater than 0.' }, { status: 400 })
        }

        // Parse Date safely
        let parsedDate = new Date()
        if (date) {
            const parts = date.split('.')
            if (parts.length === 3) {
                parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
            }
        }

        let driveFileId: string | null = null
        let driveFileLink: string | null = null

        // If ID exists, we are in EDIT mode.
        let existingRecord = null
        if (id) {
            existingRecord = await prisma.employeeWork.findUnique({ where: { id } })
            if (!existingRecord) {
                return NextResponse.json({ error: 'Record not found for editing.' }, { status: 404 })
            }
            // Preserve existing file links by default (comma-separated IDs, and Folder Link)
            driveFileId = existingRecord.driveFileId
            driveFileLink = existingRecord.driveFileLink
        }

        // Output array for newly generated file IDs
        const uploadedFileIds: string[] = []

        // If we have actual file uploads (New or replacements)
        if (files && files.length > 0) {

            const parentDriveFolderId = '1NJ37mPhzviW9CUtggSJOovPP2Dgz2JOX' // Employees root

            // Reformat DD.MM.YYYY to D-M-YYYY for the folder name
            const dParts = date.split('.')
            const safeDateFolder = dParts.length === 3 ? `${parseInt(dParts[0])}-${parseInt(dParts[1])}-${dParts[2]}` : date.replace(/\./g, '-')
            const targetFolderName = `${employeeName}-${safeDateFolder}`

            console.log(`[Employee Work Save] Searching for subfolder: ${targetFolderName}`)

            // Search for existing subfolder
            const searchRes = await driveClient.files.list({
                q: `mimeType='application/vnd.google-apps.folder' and name='${targetFolderName}' and '${parentDriveFolderId}' in parents and trashed=false`,
                fields: 'files(id, name, webViewLink)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
            })

            let uploadFolderId = searchRes.data.files && searchRes.data.files.length > 0
                ? searchRes.data.files[0].id
                : null

            let uploadFolderLink = searchRes.data.files && searchRes.data.files.length > 0
                ? searchRes.data.files[0].webViewLink
                : null

            // Create subfolder if it doesn't exist
            if (!uploadFolderId) {
                console.log(`[Employee Work Save] Subfolder not found. Creating: ${targetFolderName}`)
                const folderCreateRes = await driveClient.files.create({
                    requestBody: {
                        name: targetFolderName,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [parentDriveFolderId]
                    },
                    fields: 'id, webViewLink',
                    supportsAllDrives: true
                })
                uploadFolderId = folderCreateRes.data.id
                uploadFolderLink = folderCreateRes.data.webViewLink

                if (uploadFolderId) {
                    try {
                        await driveClient.permissions.create({
                            fileId: uploadFolderId,
                            requestBody: { role: 'reader', type: 'anyone' },
                            supportsAllDrives: true
                        })
                    } catch (permErr: any) {
                        console.log(`[Drive Permissions] Folder inherited or failed: ${permErr.message}`)
                    }
                }
            }

            // Loop and upload ALL files into this folder
            for (const file of files) {
                if (file.size === 0) continue;

                console.log(`[Employee Work Save] Uploading ${file.name} to ${targetFolderName} (${uploadFolderId})...`)

                const arrayBuffer = await file.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                const stream = new Readable()
                stream.push(buffer)
                stream.push(null)

                const uploadedFile = await driveClient.files.create({
                    requestBody: {
                        name: `EMP_${employeeName}_${date}_${projectNumber || 'NoProj'}_${file.name}`,
                        parents: [uploadFolderId!],
                    },
                    media: {
                        mimeType: file.type || 'application/octet-stream',
                        body: stream
                    },
                    fields: 'id',
                    supportsAllDrives: true
                })

                if (uploadedFile.data.id) {
                    uploadedFileIds.push(uploadedFile.data.id)
                    // Set permission on the individual file to ensure accessibility just in case
                    try {
                        await driveClient.permissions.create({
                            fileId: uploadedFile.data.id,
                            requestBody: { role: 'reader', type: 'anyone' },
                            supportsAllDrives: true
                        })
                    } catch (permErr: any) {
                        console.log(`[Drive Permissions] File inherited or failed: ${permErr.message}`)
                    }
                }
            }

            // If we are in EDIT mode and are successfully uploading NEW files, delete the OLD files from Drive to prevent garbage buildup
            if (id && existingRecord?.driveFileId) {
                const oldIds = existingRecord.driveFileId.split(',')
                for (const oldId of oldIds) {
                    if (oldId.trim()) {
                        try {
                            console.log(`[Employee Work Save] Deleting old file from Drive: ${oldId}`)
                            await driveClient.files.delete({ fileId: oldId.trim(), supportsAllDrives: true })
                        } catch (delErr) {
                            console.error("[Employee Work Save] Failed to delete old drive file:", delErr)
                        }
                    }
                }
            }

            // Update state: store all comma-separated Raw File IDs, but strictly store the FOLDER Link in `driveFileLink`
            driveFileId = uploadedFileIds.length > 0 ? uploadedFileIds.join(',') : null
            driveFileLink = uploadFolderLink || null
        }

        // Branch: UPDATE or CREATE
        if (id) {
            console.log(`[Employee Work Save] Updating Postgres record for ID: ${id}`)
            const updatedRecord = await prisma.employeeWork.update({
                where: { id },
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

            console.log(`[Employee Work Save] Overwriting Google Sheets row natively for ID: ${id}`)
            try {
                await updateEmployeeWorkInSheet(id, {
                    employeeName,
                    date: parsedDate,
                    hours,
                    payRate,
                    extraCosts,
                    projectNumber,
                    description,
                    driveFileLink: driveFileLink || null
                })
            } catch (excelErr) {
                console.error("[Employee Work Save] Excel Update failed:", excelErr)
            }

            return NextResponse.json({ success: true, data: updatedRecord })
        } else {
            console.log(`[Employee Work Save] Creating new Postgres record for ${employeeName}`)
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

            try {
                await appendEmployeeWorkToSheet({
                    id: workRecord.id,
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
        }

    } catch (error: any) {
        console.error('[Employee Work Save] Fatal Error:', error)
        return NextResponse.json({ error: error.message || 'Failed to save employee work' }, { status: 500 })
    }
}
