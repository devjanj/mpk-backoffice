import { Sidebar } from '@/components/Sidebar'
import { Users } from 'lucide-react'
import prisma from '@/lib/prisma'
import { EmployeesDashboard } from '@/components/EmployeesDashboard'

// Allow fresh dynamic building without aggressive Vercel caching
export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
    // 1. Fetch all tracking records from PostgreSQL
    const employeeWorkRecords = await prisma.employeeWork.findMany({
        orderBy: { date: 'desc' }
    })

    // 2. Fetch all valid project numbers to feed the project dropdown in the frontend modal
    const projects = await prisma.projectStatus.findMany({
        select: { projectNumber: true }
    })
    const existingProjectNumbers = projects.map(p => p.projectNumber)

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
            <Sidebar />

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
        </div>
    )
}
