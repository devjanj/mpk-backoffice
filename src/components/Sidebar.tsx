'use client'

import { useState } from 'react'
import { BarChart3, Euro, FolderKanban, LogOut, FileText, Wallet, Users, Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

function SidebarItem({ icon, label, href, active = false, onClick }: { icon: React.ReactNode, label: string, href: string, active?: boolean, onClick?: () => void }) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${active ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted font-medium'}`}
        >
            <span className={active ? "text-primary" : "text-muted-foreground"}>{icon}</span>
            {label}
        </Link>
    )
}

export function Sidebar() {
    const pathname = usePathname()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const navItems = (
        <nav className="space-y-2">
            <SidebarItem icon={<BarChart3 />} label="Overview" href="/" active={pathname === '/'} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={<FolderKanban />} label="Projects" href="/projects" active={pathname === '/projects'} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={<Users />} label="Employees" href="/employees" active={pathname === '/employees'} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={<FileText />} label="Invoices (Bank + CF)" href="/invoices" active={pathname === '/invoices'} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={<Wallet />} label="Earnings (CF)" href="/earnings/cf" active={pathname === '/earnings/cf'} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={<Euro />} label="Earnings (Bank)" href="/earnings/bank" active={pathname === '/earnings/bank'} onClick={() => setIsMobileMenuOpen(false)} />
        </nav>
    )

    return (
        <>
            {/* Desktop Sidebar (Hidden on Mobile) */}
            <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur-md flex-col justify-between hidden md:flex p-6 min-h-screen sticky top-0">
                <div>
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
                            <FolderKanban className="w-6 h-6" />
                        </div>
                        <h2 className="font-bold text-lg leading-tight tracking-tight">MPK<br /><span className="text-muted-foreground font-normal text-sm">Dashboard</span></h2>
                    </div>
                    {navItems}
                </div>

                <form action="/login" method="POST">
                    <button className="flex items-center gap-3 text-muted-foreground hover:text-red-500 transition-colors py-2 px-3 rounded-xl hover:bg-red-500/10 w-full group">
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Logout</span>
                    </button>
                </form>
            </aside>

            {/* Mobile Topbar (Visible on Mobile only) */}
            <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border/50 sticky top-0 z-40 bg-background/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary/20 text-primary rounded-lg flex items-center justify-center">
                        <FolderKanban className="w-5 h-5" />
                    </div>
                    <h2 className="font-bold text-lg leading-tight tracking-tight">MPK</h2>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 -mr-2 text-foreground hover:bg-muted rounded-xl transition-colors"
                >
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile Fullscreen Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="fixed inset-0 z-50 bg-background flex flex-col p-6 overflow-y-auto md:hidden"
                    >
                        <div className="flex items-center justify-between mb-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
                                    <FolderKanban className="w-6 h-6" />
                                </div>
                                <h2 className="font-bold text-lg leading-tight tracking-tight">MPK<br /><span className="text-muted-foreground font-normal text-sm">Dashboard</span></h2>
                            </div>
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="p-2 -mr-2 bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1">
                            {navItems}
                        </div>

                        <div className="mt-8 pt-8 border-t border-border/50">
                            <form action="/login" method="POST">
                                <button className="flex items-center gap-3 text-muted-foreground hover:text-red-500 transition-colors py-3 px-3 rounded-xl hover:bg-red-500/10 w-full group">
                                    <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                    <span className="font-medium text-lg">Logout</span>
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
