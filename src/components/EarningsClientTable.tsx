'use client'

import { useState, useEffect, useMemo } from 'react'
import { FinanceRow } from '@/lib/google-sheets'
import { FileText, ArrowUpRight, ChevronLeft, ChevronRight, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react'
import Link from 'next/link'
import { TransactionSplitModal } from '@/components/TransactionSplitModal'

export function EarningsClientTable({ transactions, title }: { transactions: FinanceRow[], title: string }) {
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

    // Sorting and Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const [sortField, setSortField] = useState<'date' | 'income' | 'outcome'>('date')
    const [sortDesc, setSortDesc] = useState(true)
    const ITEMS_PER_PAGE = 15

    const sortedAndPaginatedTransactions = useMemo(() => {
        if (!transactions) return { items: [], totalPages: 0 }

        let sorted = [...transactions]

        // Parse DD.MM.YYYY to sortable number
        const parseDate = (dStr: string) => {
            if (!dStr) return 0;
            const parts = dStr.split('.');
            if (parts.length === 3) {
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).valueOf()
            }
            return 0;
        }

        const parseEuro = (eStr: string) => {
            if (!eStr) return 0;
            const cleaned = eStr.replace(/[^0-9,-]/g, '').replace(',', '.')
            return parseFloat(cleaned) || 0
        }

        sorted.sort((a, b) => {
            let valA = 0
            let valB = 0

            if (sortField === 'date') {
                valA = parseDate(a.date)
                valB = parseDate(b.date)
            } else if (sortField === 'income') {
                valA = parseEuro(a.income)
                valB = parseEuro(b.income)
            } else if (sortField === 'outcome') {
                valA = parseEuro(a.outcome)
                valB = parseEuro(b.outcome)
            }

            if (valA < valB) return sortDesc ? 1 : -1
            if (valA > valB) return sortDesc ? -1 : 1
            return 0
        })

        const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE)
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE

        return {
            items: sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE),
            totalPages: totalPages === 0 ? 1 : totalPages
        }
    }, [transactions, currentPage, sortField, sortDesc])

    const handleSort = (field: 'date' | 'income' | 'outcome') => {
        if (sortField === field) {
            setSortDesc(!sortDesc)
        } else {
            setSortField(field)
            setSortDesc(true)
        }
        setCurrentPage(1) // Reset to first page on sort change
    }

    const renderSortIcon = (field: 'date' | 'income' | 'outcome') => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />
        return sortDesc ? <ArrowDown className="w-3 h-3 ml-1 text-primary" /> : <ArrowUp className="w-3 h-3 ml-1 text-primary" />
    }

    return (
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    {title}
                </h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4 font-semibold cursor-pointer group hover:text-foreground transition-colors" onClick={() => handleSort('date')}>
                                <div className="flex items-center">Date {renderSortIcon('date')}</div>
                            </th>
                            <th className="px-6 py-4 font-semibold">Project #</th>
                            <th className="px-6 py-4 font-semibold">Description</th>
                            <th className="px-6 py-4 font-semibold text-green-600 dark:text-green-500 cursor-pointer group hover:text-green-700 transition-colors" onClick={() => handleSort('income')}>
                                <div className="flex items-center">Income {renderSortIcon('income')}</div>
                            </th>
                            <th className="px-6 py-4 font-semibold text-red-600 dark:text-red-500 cursor-pointer group hover:text-red-700 transition-colors" onClick={() => handleSort('outcome')}>
                                <div className="flex items-center">Outcome {renderSortIcon('outcome')}</div>
                            </th>
                            <th className="px-6 py-4 font-semibold">Note</th>
                            <th className="px-6 py-4 font-semibold">Invoice URL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {sortedAndPaginatedTransactions.items.length > 0 ? sortedAndPaginatedTransactions.items.map((row, i) => (
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

            {/* Pagination Controls */}
            {sortedAndPaginatedTransactions.totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10">
                    <span className="text-sm text-muted-foreground">
                        Page <span className="font-semibold text-foreground">{currentPage}</span> of <span className="font-semibold text-foreground">{sortedAndPaginatedTransactions.totalPages}</span>
                        <span className="ml-2">({transactions.length} total records)</span>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(sortedAndPaginatedTransactions.totalPages, p + 1))}
                            disabled={currentPage === sortedAndPaginatedTransactions.totalPages}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

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
