import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
    try {
        const [projectStatuses, invoices, splits, allocations, legacyWork] = await Promise.all([
            prisma.projectStatus.findMany({ select: { projectNumber: true } }),
            prisma.invoice.findMany({ select: { projectNumber: true }, distinct: ['projectNumber'] }),
            prisma.transactionSplit.findMany({ select: { projectNumber: true }, distinct: ['projectNumber'] }),
            // @ts-ignore
            prisma.employeeWorkAllocation.findMany({ select: { projectNumber: true }, distinct: ['projectNumber'] }),
            prisma.employeeWork.findMany({ select: { projectNumber: true }, distinct: ['projectNumber'] })
        ])

        const allProjects = new Set([
            ...projectStatuses.map((p: any) => p.projectNumber),
            ...invoices.map((i: any) => i.projectNumber),
            ...splits.map((s: any) => s.projectNumber),
            ...allocations.map((a: any) => a.projectNumber),
            ...legacyWork.map((w: any) => w.projectNumber)
        ])

        const existingProjectNumbers = Array.from(allProjects)
            .filter(p => typeof p === 'string' && p.trim() !== '' && p !== 'Unassigned' && p !== '-' && p !== 'NO_PROJ')
            .sort()

        return NextResponse.json({ success: true, data: existingProjectNumbers })
    } catch (err: any) {
        console.error("Failed to fetch global projects:", err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
