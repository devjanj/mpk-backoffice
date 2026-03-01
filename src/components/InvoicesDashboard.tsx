'use client'

import { useState, useMemo, useEffect } from 'react'
import { FinanceRow } from '@/lib/google-sheets'
import { FileText, Search, Link as LinkIcon, ChevronLeft, ChevronRight, ArrowUpDown, Split, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { parseEuropeanNumber } from '@/components/CFCacheManager'
import { TransactionSplitModal } from '@/components/TransactionSplitModal'

export function InvoicesDashboard({ initialData }: { initialData: FinanceRow[] }) {
    const [combinedData, setCombinedData] = useState<FinanceRow[]>(initialData)
    const [searchQuery, setSearchQuery] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' })

    const [splits, setSplits] = useState<any[]>([])

    // Modal State
    const [selectedTx, setSelectedTx] = useState<FinanceRow | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const itemsPerPage = 20

    // Fetch dynamic project splits from the parallel PostgreSQL Database
    const fetchSplits = () => {
        fetch('/api/transaction-splits')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setSplits(data.data)
                }
            })
            .catch(err => console.error("Failed to fetch splits:", err))
    }

    useEffect(() => {
        fetchSplits()
    }, [])

    // Try to merge CF data as well for a completely unified "All Transactions" view
    useEffect(() => {
        try {
            const cfAllStr = localStorage.getItem('cf_all_data')
            if (cfAllStr) {
                const cfAll = JSON.parse(cfAllStr)
                if (Array.isArray(cfAll) && cfAll.length > 0) {
                    const mappedCF: FinanceRow[] = cfAll.map((c: any) => ({
                        id: c.id,
                        month: c.month,
                        projectNumber: c.projectNumber || '-',
                        date: c.date,
                        description: c.description,
                        income: c.income,
                        outcome: c.outcome,
                        currentBalance: c.currentBalance,
                        transactionUrl: c.invoiceUrl,
                        notes: c.note
                    }))

                    // Prevent duplicate merging if the component re-mounts in development
                    setCombinedData(prev => {
                        // Check if CF records are already in there by checking description/date exact matches? 
                        // It's simpler to just replace the whole array state with initial + CF.
                        return [...initialData, ...mappedCF]
                    })
                }
            }
        } catch (e) {
            console.error("Failed to parse CF data for Invoices", e)
        }
    }, [initialData])

    // Sorting and Filtering
    const processedData = useMemo(() => {
        let filtered = combinedData.filter(row => {
            const query = searchQuery.toLowerCase()
            return (
                (row.description || '').toLowerCase().includes(query) ||
                (row.projectNumber || '').toLowerCase().includes(query) ||
                (row.notes || '').toLowerCase().includes(query)
            )
        })

        filtered.sort((a, b) => {
            if (sortConfig.key === 'date') {
                const getTimestamp = (dStr: string) => {
                    if (!dStr) return 0
                    const parts = dStr.split('.')
                    if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime()
                    return 0
                }
                const aTime = getTimestamp(a.date)
                const bTime = getTimestamp(b.date)
                return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime
            } else if (sortConfig.key === 'income') {
                const aInc = parseEuropeanNumber(a.income)
                const bInc = parseEuropeanNumber(b.income)
                return sortConfig.direction === 'asc' ? aInc - bInc : bInc - aInc
            } else if (sortConfig.key === 'outcome') {
                const aOut = parseEuropeanNumber(a.outcome)
                const bOut = parseEuropeanNumber(b.outcome)
                return sortConfig.direction === 'asc' ? aOut - bOut : bOut - aOut
            } else if (sortConfig.key === 'project') {
                const aProj = a.projectNumber || ''
                const bProj = b.projectNumber || ''
                return sortConfig.direction === 'asc' ? aProj.localeCompare(bProj) : bProj.localeCompare(aProj)
            }
            return 0
        })

        return filtered
    }, [combinedData, searchQuery, sortConfig])

    const totalPages = Math.ceil(processedData.length / itemsPerPage)
    const currentData = processedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
        setSortConfig({ key, direction })
    }

    return (
        <div className="space-y-6">
            <div className="bg-card border border-border/50 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by description, project, or notes..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-background border border-border/50 text-foreground text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary transition-all shadow-sm"
                    />
                </div>
                <div className="text-sm font-medium text-muted-foreground whitespace-nowrap bg-muted/40 px-4 py-2 rounded-xl">
                    Showing <span className="text-foreground font-bold">{processedData.length}</span> entries
                </div>
            </div>

            <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/40 tracking-wide">
                            <tr>
                                <th className="px-6 py-4 font-medium min-w-[120px] cursor-pointer hover:text-foreground transition-colors group" onClick={() => requestSort('date')}>
                                    <div className="flex items-center gap-2">Date <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'date' ? 'text-primary' : 'opacity-30 group-hover:opacity-100'} transition-all`} /></div>
                                </th>
                                <th className="px-6 py-4 font-medium min-w-[120px] cursor-pointer hover:text-foreground transition-colors group" onClick={() => requestSort('project')}>
                                    <div className="flex items-center gap-2">Project # <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'project' ? 'text-primary' : 'opacity-30 group-hover:opacity-100'} transition-all`} /></div>
                                </th>
                                <th className="px-6 py-4 font-medium min-w-[250px]">Description</th>
                                <th className="px-6 py-4 font-medium cursor-pointer hover:text-foreground transition-colors group" onClick={() => requestSort('income')}>
                                    <div className="flex items-center gap-2">Income <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'income' ? 'text-primary' : 'opacity-30 group-hover:opacity-100'} transition-all`} /></div>
                                </th>
                                <th className="px-6 py-4 font-medium cursor-pointer hover:text-foreground transition-colors group" onClick={() => requestSort('outcome')}>
                                    <div className="flex items-center gap-2">Outcome <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'outcome' ? 'text-primary' : 'opacity-30 group-hover:opacity-100'} transition-all`} /></div>
                                </th>
                                <th className="px-6 py-4 font-medium">Note</th>
                                <th className="px-6 py-4 font-medium text-right">Invoice URL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            <AnimatePresence mode="popLayout">
                                {currentData.map((tx, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.1, delay: i * 0.02 }}
                                        key={tx.id || `${tx.date}-${tx.description}-${i}`}
                                        onClick={() => {
                                            setSelectedTx(tx)
                                            setIsModalOpen(true)
                                        }}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{tx.date || tx.month}</td>
                                        <td className="px-6 py-4 font-medium">
                                            {tx.projectNumber && tx.projectNumber !== '-' ? (
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap">{tx.projectNumber}</span>
                                                    {splits.some(s => s.transactionHash === tx.id) && (
                                                        <span className="bg-purple-500/10 text-purple-500 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider">
                                                            <Split className="w-3 h-3" /> Split
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span>-</span>
                                                    {splits.some(s => s.transactionHash === tx.id) && (
                                                        <span className="bg-purple-500/10 text-purple-500 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider">
                                                            <Split className="w-3 h-3" /> Split
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-foreground font-medium max-w-[300px] truncate" title={tx.description}>{tx.description}</td>
                                        <td className="px-6 py-4 text-emerald-500 font-medium whitespace-nowrap">{tx.income || '-'}</td>
                                        <td className="px-6 py-4 text-red-500 font-medium whitespace-nowrap">{tx.outcome || '-'}</td>
                                        <td className="px-6 py-4 max-w-[150px] truncate" title={tx.notes}>{tx.notes || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                                                {/* If it has a transactionUrl, it's likely an uploaded file we can delete if it's from the DB */}
                                                {tx.transactionUrl && tx.id && tx.id.length < 64 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (confirm('Are you sure you want to delete this invoice? This will remove the document from Google Drive.')) {
                                                                fetch('/api/invoice/delete', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ id: tx.id, transactionUrl: tx.transactionUrl })
                                                                }).then(res => res.json()).then(data => {
                                                                    if (data.success) {
                                                                        setCombinedData(prev => prev.filter(r => r.id !== tx.id))
                                                                    } else {
                                                                        alert(data.error || 'Failed to delete')
                                                                    }
                                                                }).catch(() => alert('Failed to delete'))
                                                            }
                                                        }}
                                                        className="text-red-500 hover:text-red-400 bg-red-500/10 p-2 rounded-lg inline-flex transition-transform hover:scale-105"
                                                        title="Delete Invoice"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {tx.transactionUrl ? (
                                                    <a href={tx.transactionUrl} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80 bg-primary/10 p-2 rounded-lg inline-flex transition-transform flex items-center gap-1 hover:scale-105" title="View Document">
                                                        Link <LinkIcon className="w-3 h-3" />
                                                    </a>
                                                ) : '-'}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                            {currentData.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-muted-foreground">No transactions found matching your criteria.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-border/50 flex items-center justify-between bg-muted/10">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="p-2 bg-card border border-border/50 rounded-xl hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="text-sm font-medium">Page {currentPage} of {totalPages}</div>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="p-2 bg-card border border-border/50 rounded-xl hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            <TransactionSplitModal
                transaction={selectedTx}
                existingSplits={splits.filter(s => s.transactionHash === selectedTx?.id)}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={fetchSplits}
            />
        </div >
    )
}
