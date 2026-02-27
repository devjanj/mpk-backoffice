'use client'

import { useState, useEffect, useMemo } from 'react'
import { FolderKanban, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { FinanceRow } from '@/lib/google-sheets'
import { parseEuropeanNumber } from '@/components/CFCacheManager'
import Link from 'next/link'

export function ActiveProjectsOverview({ initialData }: { initialData: FinanceRow[] }) {
    const [combinedData, setCombinedData] = useState<FinanceRow[]>([])
    const [splits, setSplits] = useState<any[]>([])
    const [projectStatuses, setProjectStatuses] = useState<Record<string, string>>({})
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let cfData: FinanceRow[] = []
        try {
            const cfAllStr = localStorage.getItem('cf_all_data')
            if (cfAllStr) {
                const cfAll = JSON.parse(cfAllStr)
                if (Array.isArray(cfAll)) {
                    cfData = cfAll.map((c: any) => ({
                        id: c.id,
                        month: c.month,
                        projectNumber: c.projectNumber,
                        date: c.date,
                        description: c.description,
                        income: c.income,
                        outcome: c.outcome,
                        currentBalance: c.currentBalance,
                        transactionUrl: c.invoiceUrl,
                        notes: c.note
                    }))
                }
            }
        } catch (e) {
            console.error("Failed to parse CF data", e)
        }

        setCombinedData([...initialData, ...cfData])

        Promise.all([
            fetch('/api/transaction-splits').then(res => res.json()),
            fetch('/api/project-status').then(res => res.json())
        ]).then(([splitsData, statusData]) => {
            if (splitsData.success) setSplits(splitsData.data)

            if (statusData.success) {
                const statusMap: Record<string, string> = {}
                statusData.data.forEach((ps: any) => {
                    statusMap[ps.projectNumber] = ps.status
                })
                setProjectStatuses(statusMap)
            }
        }).catch(err => console.error("Failed to fetch dependencies:", err))
            .finally(() => setIsLoading(false))

    }, [initialData])

    const activeProjectStats = useMemo(() => {
        if (!combinedData.length || isLoading) return []

        const projectDataMap: Record<string, { income: number, outcome: number, txCount: number, lastActivity: string }> = {}

        const processRow = (projectNumber: string, incomeStr: string, outcomeStr: string, date: string) => {
            if (!projectNumber || projectNumber === '-') return

            if (!projectDataMap[projectNumber]) {
                projectDataMap[projectNumber] = { income: 0, outcome: 0, txCount: 0, lastActivity: date }
            }

            if (incomeStr) projectDataMap[projectNumber].income += parseEuropeanNumber(incomeStr)
            if (outcomeStr) projectDataMap[projectNumber].outcome += parseEuropeanNumber(outcomeStr)

            projectDataMap[projectNumber].txCount++

            // Keep the most recent date string (assuming string sort works loosely for these dates or just any date)
            if (date && date > projectDataMap[projectNumber].lastActivity) {
                projectDataMap[projectNumber].lastActivity = date
            }
        }

        combinedData.forEach(row => {
            const hasSplits = splits.filter(s => s.transactionHash === row.id)
            if (hasSplits.length > 0) {
                hasSplits.forEach(split => {
                    const sign = row.income ? 1 : -1
                    const splitVal = split.amount
                    const sIncome = sign === 1 ? `€ ${splitVal}` : ''
                    const sOutcome = sign === -1 ? `€ ${splitVal}` : ''
                    processRow(split.projectNumber, sIncome, sOutcome, row.date)
                })
            } else {
                processRow(row.projectNumber, row.income || '', row.outcome || '', row.date)
            }
        })

        const activeProjects = Object.keys(projectDataMap)
            .filter(p => (projectStatuses[p] || 'ACTIVE') === 'ACTIVE')
            .map(p => ({
                projectNumber: p,
                ...projectDataMap[p],
                profit: projectDataMap[p].income - projectDataMap[p].outcome
            }))
            .sort((a, b) => b.profit - a.profit)

        return activeProjects

    }, [combinedData, splits, projectStatuses, isLoading])

    if (isLoading) {
        return <div className="animate-pulse bg-muted/20 h-64 rounded-3xl w-full"></div>
    }

    return (
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <FolderKanban className="w-5 h-5 text-primary" />
                    Active Projects Overview
                </h3>
                <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                    {activeProjectStats.length} Active
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Project #</th>
                            <th className="px-6 py-4 font-semibold">Transactions</th>
                            <th className="px-6 py-4 font-semibold text-green-600 dark:text-green-500 text-right">Income</th>
                            <th className="px-6 py-4 font-semibold text-red-600 dark:text-red-500 text-right">Outcome</th>
                            <th className="px-6 py-4 font-semibold text-right">Net Balance</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {activeProjectStats.map((p, i) => {
                            const isProfitable = p.profit >= 0
                            return (
                                <tr key={i} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-4 font-bold text-foreground">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                                            {p.projectNumber}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground font-medium">
                                        {p.txCount} records
                                    </td>
                                    <td className="px-6 py-4 text-green-600 dark:text-green-500 font-medium text-right whitespace-nowrap">
                                        € {p.income.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-red-600 dark:text-red-500 font-medium text-right whitespace-nowrap">
                                        € {p.outcome.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <span className={`px-3 py-1.5 rounded-lg font-bold flex items-center justify-end gap-1.5 w-fit ml-auto ${isProfitable ? 'bg-green-500/10 text-green-600 dark:text-green-500' : 'bg-red-500/10 text-red-600 dark:text-red-500'
                                            }`}>
                                            {isProfitable ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                            € {p.profit.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link href={`/projects?id=${encodeURIComponent(p.projectNumber)}`} className="text-primary hover:text-primary/80 font-semibold text-xs bg-primary/10 px-3 py-2 rounded-lg transition-colors">
                                            View Details
                                        </Link>
                                    </td>
                                </tr>
                            )
                        })}
                        {activeProjectStats.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center py-12 text-muted-foreground">No active projects found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
