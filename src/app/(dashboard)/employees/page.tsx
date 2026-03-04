import { Users } from 'lucide-react'
import prisma from '@/lib/prisma'
import { syncFinanceSheet } from '@/lib/google-sheets'
import { EmployeesDashboard } from '@/components/EmployeesDashboard'

// Allow fresh dynamic building without aggressive Vercel caching
export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
    // 1. Fetch all tracking records from PostgreSQL
    const employeeWorkRecords = await prisma.employeeWork.findMany({
        orderBy: { date: 'desc' },
        include: { allocations: true }
    })

    // 2. Extensively fetch all valid project numbers across the system to feed the autocomplete dropdown
    const [projectStatuses, invoices, splits, allocations, legacyWork, financeRes] = await Promise.all([
        prisma.projectStatus.findMany({ select: { projectNumber: true } }),
        prisma.invoice.findMany({ select: { projectNumber: true }, distinct: ['projectNumber'] }),
        prisma.transactionSplit.findMany({ select: { projectNumber: true }, distinct: ['projectNumber'] }),
        // @ts-ignore - NextJS TS Server cache might lag Native Prisma Generation
        prisma.employeeWorkAllocation.findMany({ select: { projectNumber: true }, distinct: ['projectNumber'] }),
        prisma.employeeWork.findMany({ select: { projectNumber: true }, distinct: ['projectNumber'] }),
        syncFinanceSheet()
    ])

    const financeProjects = (financeRes?.success && financeRes.data)
        ? financeRes.data.map((r: any) => r.projectNumber)
        : []

    const allProjects = new Set([
        ...projectStatuses.map((p: any) => p.projectNumber),
        ...invoices.map((i: any) => i.projectNumber),
        ...splits.map((s: any) => s.projectNumber),
        // @ts-ignore - Prisma Client typings cache might lag behind exact deployment models
        ...allocations.map((a: any) => a.projectNumber),
        ...legacyWork.map((w: any) => w.projectNumber),
        ...financeProjects
    ])

    // Clean up empty, null, or placeholder entries
    const existingProjectNumbers = Array.from(allProjects)
        .filter(p => typeof p === 'string' && p.trim() !== '' && p !== 'Unassigned' && p !== '-' && p !== 'NO_PROJ')
        .sort()

    return (
        <>
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                            <Users className="w-8 h-8 text-primary" />
                            Employees Work Tracking
                        </h1>
                        <p className="text-muted-foreground">Manage and track working hours, pay rates, and associated documentation for Žan, Jan, and Marko.</p>
                    </div>
                </header>

                <EmployeesDashboard
                    initialData={employeeWorkRecords}
                    existingProjectNumbers={existingProjectNumbers}
                />
            </main>
        </>
    )
}
