'use client'

import { BarChart3, Euro, FolderKanban, LogOut, FileText, Wallet } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

function SidebarItem({ icon, label, href, active = false }: { icon: React.ReactNode, label: string, href: string, active?: boolean }) {
    return (
        <Link href={href} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${active ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted font-medium'}`}>
            <span className={active ? "text-primary" : "text-muted-foreground"}>{icon}</span>
            {label}
        </Link>
    )
}

export function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur-md flex flex-col justify-between hidden md:flex p-6 min-h-screen">
            <div>
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
                        <FolderKanban className="w-6 h-6" />
                    </div>
                    <h2 className="font-bold text-lg leading-tight tracking-tight">MPK<br /><span className="text-muted-foreground font-normal text-sm">Dashboard</span></h2>
                </div>

                <nav className="space-y-2">
                    <SidebarItem icon={<BarChart3 />} label="Overview" href="/" active={pathname === '/'} />
                    <SidebarItem icon={<FolderKanban />} label="Projects" href="/projects" active={pathname === '/projects'} />
                    <SidebarItem icon={<FileText />} label="Invoices (Bank + CF)" href="/invoices" active={pathname === '/invoices'} />
                    <SidebarItem icon={<Wallet />} label="Earnings (CF)" href="/earnings/cf" active={pathname === '/earnings/cf'} />
                    <SidebarItem icon={<Euro />} label="Earnings (Bank)" href="/earnings/bank" active={pathname === '/earnings/bank'} />
                </nav>
            </div>

            <form action="/login" method="POST">
                <button className="flex items-center gap-3 text-muted-foreground hover:text-red-500 transition-colors py-2 px-3 rounded-xl hover:bg-red-500/10 w-full group">
                    <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium">Logout</span>
                </button>
            </form>
        </aside>
    )
}
