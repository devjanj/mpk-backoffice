import { Sidebar } from '@/components/Sidebar'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 overflow-y-auto relative">
                {children}
            </main>
        </div>
    )
}
