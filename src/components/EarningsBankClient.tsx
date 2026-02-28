'use client'

import { useState, useEffect } from 'react'
import { FinanceRow } from '@/lib/google-sheets'
import { FileText, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { TransactionSplitModal } from '@/components/TransactionSplitModal'

export function EarningsBankClient({ transactions }: { transactions: FinanceRow[] }) {
    const [selectedTx, setSelectedTx] = useState<FinanceRow | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [splits, setSplits] = useState<any[]>([])

    const fetchSplits = () => {
        fetch('/api/transaction-splits')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setSplits(data.data)
                }
            })
            .catch(err => console.error("Failed to fetch splits:", err))
    };

    useEffect(() => {
        fetchSplits()
    }, [])

    return (
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Bank Transactions
                </h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Date</th>
                            <th className="px-6 py-4 font-semibold">Project #</th>
                            <th className="px-6 py-4 font-semibold">Description</th>
                            <th className="px-6 py-4 font-semibold text-green-600 dark:text-green-500">Income</th>
                            <th className="px-6 py-4 font-semibold text-red-600 dark:text-red-500">Outcome</th>
                            <th className="px-6 py-4 font-semibold">Note</th>
                            <th className="px-6 py-4 font-semibold">Invoice URL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {transactions && transactions.length > 0 ? transactions.map((row, i) => (
                            <tr
                                key={i}
                                onClick={() => {
                                    if (row.id) {
                                        setSelectedTx(row)
                                        setIsModalOpen(true)
                                    }
                                }}
                                className={`transition-colors cursor-pointer ${row.id ? 'hover:bg-muted/50' : ''}`}
                            >
                                <td className="px-6 py-4 whitespace-nowrap">{row.date}</td>
                                <td className="px-6 py-4 font-medium">{row.projectNumber}</td>
                                <td className="px-6 py-4 max-w-[200px] truncate" title={row.description}>{row.description}</td>
                                <td className="px-6 py-4 text-green-600 dark:text-green-500 font-medium">{row.income || '-'}</td>
                                <td className="px-6 py-4 text-red-600 dark:text-red-500 font-medium">{row.outcome || '-'}</td>
                                <td className="px-6 py-4 max-w-[150px] truncate" title={row.notes}>{row.notes}</td>
                                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                    {row.transactionUrl ? (
                                        <Link href={row.transactionUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1">
                                            Link <ArrowUpRight className="w-3 h-3" />
                                        </Link>
                                    ) : '-'}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-muted-foreground">No bank transactions found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Split/View Modal */}
            <TransactionSplitModal
                transaction={selectedTx}
                existingSplits={splits.filter(s => s.transactionHash === selectedTx?.id)}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    setSelectedTx(null)
                }}
                onSave={fetchSplits}
            />
        </div>
    )
}
