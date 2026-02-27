import { Sidebar } from '@/components/Sidebar'
import { syncFinanceSheet } from '@/lib/google-sheets'
import { InvoicesDashboard } from '@/components/InvoicesDashboard'
import { FileText } from 'lucide-react'

// Allow fresh dynamic building without aggressive Vercel caching
export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
    // Syncs both the 2025 Google Sheet data AND the 2026 local XML bank export
    const result = await syncFinanceSheet()
    const data = (result?.success && result.data) ? result.data : []

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <Sidebar />

            <main className="flex-1 p-8 overflow-y-auto">
                <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                            <FileText className="w-8 h-8 text-primary" />
                            All Transactions
                        </h1>
                        <p className="text-muted-foreground">A unified, searchable registry of all financial transactions mapped from Google Sheets and Bank XMLs.</p>
                    </div>
                </header>

                <InvoicesDashboard initialData={data} />
            </main>
        </div>
    )
}
