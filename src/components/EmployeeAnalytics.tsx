'use client'

import React, { useMemo } from 'react'
import { EmployeeWork } from './EmployeesDashboard'
import { Euro, Clock, TrendingUp, Pickaxe } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import { MetricCard } from './MetricCard'

interface EmployeeAnalyticsProps {
    data: EmployeeWork[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function EmployeeAnalytics({ data }: EmployeeAnalyticsProps) {

    // 1. Calculate Monthly Employee Output (Hours & Costs)
    const employeeMetrics = useMemo(() => {
        const metrics = {
            'Žan': { hours: 0, cost: 0 },
            'Jan': { hours: 0, cost: 0 },
            'Marko': { hours: 0, cost: 0 }
        }

        data.forEach(entry => {
            if (metrics[entry.employeeName as keyof typeof metrics]) {
                const totalCost = (entry.hours * entry.payRate) + (entry.extraCosts || 0)
                metrics[entry.employeeName as keyof typeof metrics].hours += entry.hours
                metrics[entry.employeeName as keyof typeof metrics].cost += totalCost
            }
        })

        return [
            { name: 'Žan', hours: metrics['Žan'].hours, cost: metrics['Žan'].cost },
            { name: 'Jan', hours: metrics['Jan'].hours, cost: metrics['Jan'].cost },
            { name: 'Marko', hours: metrics['Marko'].hours, cost: metrics['Marko'].cost },
        ]
    }, [data])

    // 2. Calculate Project Time Distribution (Where are hours going?)
    const projectDistribution = useMemo(() => {
        const dist: Record<string, number> = {}

        data.forEach(entry => {
            if (entry.allocations && entry.allocations.length > 0) {
                entry.allocations.forEach(alloc => {
                    const p = alloc.projectNumber || 'Unassigned'
                    if (!dist[p]) dist[p] = 0
                    dist[p] += alloc.hours
                })
            } else {
                // Fallback for legacy data without relations
                const p = entry.projectNumber || 'Unassigned'
                if (!dist[p]) dist[p] = 0
                dist[p] += entry.hours
            }
        })

        const sorted = Object.entries(dist)
            .sort((a, b) => b[1] - a[1]) // Sort top hours highest
            .map(([name, value]) => ({ name, value }))

        return sorted
    }, [data])

    // 3. Global Efficiency Metrics
    const globalMetrics = useMemo(() => {
        let totalHours = 0
        let totalPayroll = 0
        let totalExtras = 0

        data.forEach(e => {
            totalHours += e.hours
            totalPayroll += (e.hours * e.payRate)
            totalExtras += (e.extraCosts || 0)
        })

        return { totalHours, totalPayroll, totalExtras }
    }, [data])

    const formatCurrency = (val: number) => `€ ${val.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    return (
        <div className="mt-12 space-y-8">
            <h2 className="text-2xl font-bold tracking-tight mb-2 flex items-center gap-2 border-b border-border/50 pb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
                Operational Analytics Overview
            </h2>

            {/* Top Level Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Total Billable Hours"
                    value={globalMetrics.totalHours.toFixed(1)}
                    trend="Across all projects"
                    icon={<Clock className="w-5 h-5 text-primary" />}
                />
                <MetricCard
                    title="Gross Standard Payroll"
                    value={formatCurrency(globalMetrics.totalPayroll)}
                    trend="Excluding external overhead"
                    icon={<Euro className="w-5 h-5 text-emerald-500" />}
                />
                <MetricCard
                    title="Incidentals / Extra Costs"
                    value={formatCurrency(globalMetrics.totalExtras)}
                    trend="Materials, Transport, Diets"
                    icon={<Pickaxe className="w-5 h-5 text-red-500" />}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Employee Output Bar Chart */}
                <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                    <h3 className="font-semibold text-lg mb-6">Employee Labor Output & Cost</h3>
                    <div className="w-full h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={employeeMetrics} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                                    contentStyle={{ borderRadius: '1rem', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
                                    formatter={(value: any, name: any) => [name === 'cost' ? formatCurrency(value) : `${value.toFixed(1)} h`, name === 'cost' ? 'Total Payout' : 'Hours Walked']}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Bar dataKey="hours" name="Total Hours" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                <Bar dataKey="cost" name="Payroll Cost (€)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Project Focus Pie Chart */}
                <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                    <h3 className="font-semibold text-lg mb-6">Aggregate Project Hour Distribution</h3>
                    <div className="w-full h-72 flex flex-col items-center justify-center">
                        {projectDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={projectDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={3}
                                        dataKey="value"
                                        label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                                        labelLine={false}
                                    >
                                        {projectDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '1rem', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
                                        formatter={(value: any) => [`${parseFloat(value).toFixed(1)} hours`]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-muted-foreground opacity-60 flex flex-col items-center">
                                <Pickaxe className="w-10 h-10 mb-2 opacity-50" />
                                <p>No project tracking data available.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
