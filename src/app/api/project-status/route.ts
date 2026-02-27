import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
    try {
        const statuses = await prisma.projectStatus.findMany()
        return NextResponse.json({ success: true, data: statuses })
    } catch (err: any) {
        console.error("Failed to fetch project statuses:", err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { projectNumber, status } = await req.json()

        if (!projectNumber || !status) {
            return NextResponse.json({ success: false, error: "Missing projectNumber or status" }, { status: 400 })
        }

        if (!['ACTIVE', 'FINISHED'].includes(status)) {
            return NextResponse.json({ success: false, error: "Invalid status value. Must be ACTIVE or FINISHED." }, { status: 400 })
        }

        const updated = await prisma.projectStatus.upsert({
            where: { projectNumber },
            update: { status },
            create: { projectNumber, status }
        })

        return NextResponse.json({ success: true, data: updated })
    } catch (err: any) {
        console.error("Failed to upsert project status:", err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
