'use client'

import { useState } from 'react'
import { syncFinanceSheet, type FinanceRow } from '@/lib/google-sheets'
import { RefreshCw, Table2 } from 'lucide-react'
import { motion } from 'framer-motion'

export function FinanceSyncButton() {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<FinanceRow[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSync = async () => {
        setLoading(true)
        setError(null)
        const result = await syncFinanceSheet()

        if (result.success && result.data) {
            setData(result.data)
        } else {
            setError(result.error || 'Unknown error occurred')
        }
        setLoading(false)
    }

    return (
        <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Table2 className="w-5 h-5 text-primary" />
                    Finance Sync (02_FINANCE_COPY)
                </h3>
                <button
                    onClick={handleSync}
                    disabled={loading}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Syncing...' : 'Sync Finances'}
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 text-red-500 p-4 rounded-xl mb-4 border border-red-500/20 text-sm">
                    {error}
                </div>
            )}

            {data && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Date</th>
                                    <th className="px-6 py-4 font-semibold">Project #</th>
                                    <th className="px-6 py-4 font-semibold">Description</th>
                                    <th className="px-6 py-4 font-semibold text-green-600 dark:text-green-500">Income</th>
                                    <th className="px-6 py-4 font-semibold text-red-600 dark:text-red-500">Outcome</th>
                                    <th className="px-6 py-4 font-semibold">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {data.slice(0, 5).map((row, i) => (
                                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">{row.date}</td>
                                        <td className="px-6 py-4 font-medium">{row.projectNumber}</td>
                                        <td className="px-6 py-4 max-w-xs truncate">{row.description}</td>
                                        <td className="px-6 py-4 text-green-600 dark:text-green-500 font-medium">{row.income}</td>
                                        <td className="px-6 py-4 text-red-600 dark:text-red-500 font-medium">{row.outcome}</td>
                                        <td className="px-6 py-4 font-medium">{row.currentBalance}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {data.length > 5 && (
                        <div className="bg-muted/30 p-3 text-center text-sm text-muted-foreground border-t border-border/50">
                            Showing 5 of {data.length} records.
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    )
}
