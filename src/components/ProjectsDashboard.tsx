'use client'

import { useState, useMemo, useEffect } from 'react'
import { FinanceRow } from '@/lib/google-sheets'
import { FolderKanban, Search, Link as LinkIcon, Split, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { parseEuropeanNumber } from '@/components/CFCacheManager'
import { TransactionSplitModal } from '@/components/TransactionSplitModal'

function StatCard({ title, value, valueClass }: { title: string, value: string, valueClass: string }) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-medium text-muted-foreground mb-1">{title}</h4>
            <div className={`text-2xl font-bold tracking-tight ${valueClass}`}>{value}</div>
        </div>
    )
}

export function ProjectsDashboard({ initialData }: { initialData: FinanceRow[] }) {
    const [selectedProject, setSelectedProject] = useState<string>('')
    const [combinedData, setCombinedData] = useState<FinanceRow[]>([])
    const [splits, setSplits] = useState<any[]>([])
    const [projectStatuses, setProjectStatuses] = useState<Record<string, string>>({})
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
    const searchParams = useSearchParams()

    // Modal State
    const [selectedTx, setSelectedTx] = useState<FinanceRow | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Fetch Splits
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

    const fetchStatuses = () => {
        fetch('/api/project-status')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const statusMap: Record<string, string> = {}
                    data.data.forEach((ps: any) => {
                        statusMap[ps.projectNumber] = ps.status
                    })
                    setProjectStatuses(statusMap)
                }
            })
            .catch(err => console.error("Failed to fetch project statuses:", err))
    };

    const toggleProjectStatus = async (status: 'ACTIVE' | 'FINISHED') => {
        if (!selectedProject || isUpdatingStatus) return;
        setIsUpdatingStatus(true);
        try {
            const res = await fetch('/api/project-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectNumber: selectedProject, status })
            });
            const data = await res.json();
            if (data.success) {
                setProjectStatuses(prev => ({ ...prev, [selectedProject]: status }));
            }
        } catch (err) {
            console.error("Failed to toggle status", err);
        } finally {
            setIsUpdatingStatus(false);
        }
    }

    // On mount, check if there's any CF data cached in localStorage and merge it
    useEffect(() => {
        try {
            const cfAllStr = localStorage.getItem('cf_all_data')
            if (cfAllStr) {
                const cfAll = JSON.parse(cfAllStr)
                if (Array.isArray(cfAll) && cfAll.length > 0) {
                    // Map CFRow properties to FinanceRow properties
                    const mappedCF: FinanceRow[] = cfAll.map((c: any) => ({
                        id: c.id,
                        month: c.month,
                        projectNumber: c.projectNumber,
                        date: c.date,
                        description: c.description,
                        income: c.income,
                        outcome: c.outcome,
                        currentBalance: c.currentBalance,
                        transactionUrl: c.invoiceUrl, // Normalize keys
                        notes: c.note                 // Normalize keys
                    }))
                    setCombinedData([...initialData, ...mappedCF])
                }
            }
        } catch (e) {
            console.error("Failed to parse CF data for Projects Dashboard", e)
        }

        // Fetch Splits and Statuses
        fetchSplits()
        fetchStatuses()

        const requestedProject = searchParams.get('id')
        if (requestedProject) {
            setSelectedProject(requestedProject)
        }
    }, [initialData, searchParams])

    // Extract unique project numbers (filtering out total blanks)
    const uniqueProjects = useMemo(() => {
        const set = new Set<string>()

        // Native Excel Projects (only add if the row HAS NO SPLITS)
        combinedData.forEach(row => {
            const num = row.projectNumber?.trim()
            if (num && num !== '-') {
                const hasSplits = splits.some((s: any) => s.transactionHash === row.id)
                if (!hasSplits) {
                    set.add(num)
                }
            }
        })

        // Database Split Projects
        splits.forEach(s => {
            if (s.projectNumber?.trim()) set.add(s.projectNumber.trim())
        })

        return Array.from(set).sort()
    }, [combinedData, splits])

    // Filter data by selected and intercept SPLITS
    const filteredData = useMemo(() => {
        if (!selectedProject) return []

        const results: (FinanceRow & { isSplit?: boolean })[] = []

        combinedData.forEach(row => {
            const matchingSplits = splits.filter((s: any) => s.transactionHash === row.id)

            if (matchingSplits.length > 0) {
                // Transaction is split. Only include it if one of the splits belongs to THIS project.
                const splitForThisProject = matchingSplits.find((s: any) => s.projectNumber === selectedProject)
                if (splitForThisProject) {
                    // Clone transaction but overwrite the value with the split amount
                    // Format the DB float back into European Excel string format (1.234,56) for the parser
                    let newIncome = ''
                    let newOutcome = ''

                    const formatEur = (val: number) => {
                        return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    }

                    if (row.income && !row.outcome) newIncome = formatEur(Math.abs(splitForThisProject.amount))
                    if (row.outcome && !row.income) newOutcome = formatEur(Math.abs(splitForThisProject.amount))
                    if (!row.income && !row.outcome) newOutcome = formatEur(Math.abs(splitForThisProject.amount)) // Fallback

                    results.push({
                        ...row,
                        income: newIncome,
                        outcome: newOutcome,
                        projectNumber: selectedProject,
                        isSplit: true,
                        notes: splitForThisProject.note ? `[Split Note]: ${splitForThisProject.note}` : row.notes
                    })
                }
            } else {
                // Native transaction, no splits in database
                if (row.projectNumber?.trim() === selectedProject) {
                    results.push(row)
                }
            }
        })

        return results
    }, [combinedData, splits, selectedProject])

    // Compute basic stats for the selected project
    const stats = useMemo(() => {
        if (!selectedProject) return null

        let totalIncome = 0
        let totalOutcome = 0

        filteredData.forEach(row => {
            if (row.income) {
                totalIncome += parseEuropeanNumber(row.income)
            }
            if (row.outcome) {
                totalOutcome += parseEuropeanNumber(row.outcome)
            }
        })

        return {
            income: totalIncome,
            outcome: totalOutcome,
            profit: totalIncome - totalOutcome,
            count: filteredData.length
        }
    }, [filteredData, selectedProject])

    return (
        <div className="space-y-8">
            {/* Filter Section */}
            <div className="bg-card border border-border/50 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="bg-primary/20 p-3 rounded-xl text-primary shrink-0 hidden md:block">
                    <Search className="w-5 h-5" />
                </div>
                <div className="flex-1 w-full max-w-sm">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block md:hidden">Select Project Number</label>
                    <select
                        value={selectedProject}
                        onChange={e => setSelectedProject(e.target.value)}
                        className="w-full bg-background border border-border/50 text-foreground text-sm font-medium rounded-xl focus:ring-primary focus:border-primary block p-3 outline-none transition-all cursor-pointer shadow-sm appearance-none pr-10"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor' class='w-5 h-5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9' /%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.75rem center',
                            backgroundSize: '1.2em 1.2em'
                        }}
                    >
                        <option value="">-- Choose a project --</option>
                        {uniqueProjects.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>

                {selectedProject && (
                    <div className="flex bg-muted/30 p-1 rounded-xl shrink-0 mt-4 md:mt-0 relative overflow-hidden">
                        <button
                            onClick={() => toggleProjectStatus('ACTIVE')}
                            disabled={isUpdatingStatus}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold z-10 transition-all ${(projectStatuses[selectedProject] || 'ACTIVE') === 'ACTIVE'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => toggleProjectStatus('FINISHED')}
                            disabled={isUpdatingStatus}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold z-10 transition-all ${projectStatuses[selectedProject] === 'FINISHED'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Finished
                        </button>
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
                {selectedProject && stats && filteredData.length > 0 && (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-8"
                    >
                        {/* Stats Section */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard title="Transactions" value={stats.count.toString()} valueClass="text-foreground" />
                            <StatCard title="Total Collected" value={`€ ${stats.income.toLocaleString('sl-SI', { minimumFractionDigits: 2 })}`} valueClass="text-emerald-500" />
                            <StatCard title="Total Expenses" value={`€ ${stats.outcome.toLocaleString('sl-SI', { minimumFractionDigits: 2 })}`} valueClass="text-red-500" />
                            <StatCard title="Net Balance" value={`€ ${stats.profit.toLocaleString('sl-SI', { minimumFractionDigits: 2 })}`} valueClass={stats.profit >= 0 ? "text-emerald-500" : "text-red-500"} />
                        </div>

                        {/* Transactions Table Section */}
                        <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-border/50">
                                <h3 className="font-semibold text-lg">Transaction History for {selectedProject}</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left whitespace-nowrap md:whitespace-normal">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/40">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Date</th>
                                            <th className="px-6 py-4 font-medium min-w-[200px]">Description</th>
                                            <th className="px-6 py-4 font-medium">Cash In</th>
                                            <th className="px-6 py-4 font-medium">Cash Out</th>
                                            <th className="px-6 py-4 font-medium text-right">Link / Note</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {filteredData.map((tx, i) => (
                                            <tr
                                                key={i}
                                                className="hover:bg-muted/30 transition-colors cursor-pointer"
                                                onClick={() => {
                                                    setSelectedTx(tx)
                                                    setIsModalOpen(true)
                                                }}
                                            >
                                                <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{tx.date || tx.month}</td>
                                                <td className="px-6 py-4 font-medium text-foreground">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span>{tx.description}</span>
                                                        {tx.isSplit && (
                                                            <span className="bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider w-fit">
                                                                <Split className="w-3 h-3" /> Split Allocation
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-emerald-500 font-medium whitespace-nowrap">{tx.income || '-'}</td>
                                                <td className="px-6 py-4 text-red-500 font-medium whitespace-nowrap">{tx.outcome || '-'}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-3 h-full" onClick={(e) => e.stopPropagation()}>
                                                        {tx.notes && <span className="text-xs text-muted-foreground bg-muted p-1.5 rounded-lg line-clamp-1 max-w-[150px]" title={tx.notes}>{tx.notes}</span>}
                                                        {tx.transactionUrl && tx.id && tx.id.length < 64 && !tx.isSplit && (
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
                                                        {tx.transactionUrl && (
                                                            <a href={tx.transactionUrl} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80 transition-colors bg-primary/10 p-2 rounded-lg inline-flex" title="View Transaction">
                                                                <LinkIcon className="w-4 h-4" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!selectedProject && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20 px-4 border border-dashed border-border/50 rounded-3xl"
                >
                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                        <FolderKanban className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-1">No project selected</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">Choose a project number from the dropdown above to view its transaction history and financial breakdown.</p>
                </motion.div>
            )}

            <TransactionSplitModal
                transaction={selectedTx}
                existingSplits={splits.filter(s => s.transactionHash === selectedTx?.id)}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={fetchSplits}
            />
        </div>
    )
}
