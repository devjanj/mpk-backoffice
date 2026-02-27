import { Sidebar } from '@/components/Sidebar'
import { syncFinanceSheet } from '@/lib/google-sheets'
import { ProjectsDashboard } from '@/components/ProjectsDashboard'
import { FolderKanban } from 'lucide-react'

// Allow fresh dynamic building without aggressive Vercel caching
export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
    // We already have syncFinanceSheet() built-in from google-sheets.ts. It is already cached via the inner TTL limit (60s).
    const result = await syncFinanceSheet()

    // Confidently assert it returns a FinanceRow[] or empty array
    const data = (result?.success && result.data) ? result.data : []

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <Sidebar />

            <main className="flex-1 p-8 overflow-y-auto">
                <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                            <FolderKanban className="w-8 h-8 text-primary" />
                            Project Directory
                        </h1>
                        <p className="text-muted-foreground">Filter operations, transactions, and profitability by Project Number.</p>
                    </div>
                </header>

                <ProjectsDashboard initialData={data} />
            </main>
        </div>
    )
}
