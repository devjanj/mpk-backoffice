'use client'

import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

type HistoricalBalance = {
    month: string;
    balance: number;
}

type TimeRange = '3M' | '6M' | '1Y' | 'ALL';

export function BalanceChart({ data, augmentWithCF = false }: { data: HistoricalBalance[], augmentWithCF?: boolean }) {
    const [chartData, setChartData] = useState<HistoricalBalance[]>(data)
    const [timeRange, setTimeRange] = useState<TimeRange>('6M')

    useEffect(() => {
        setChartData(data)

        if (!augmentWithCF) return

        try {
            const cfHistoryStr = localStorage.getItem('cf_history')
            if (cfHistoryStr && data) {
                const cfHist = JSON.parse(cfHistoryStr)
                if (Array.isArray(cfHist) && cfHist.length > 0) {
                    console.group('Balance Chart Debugging')
                    console.log("Original Main Data Array:", data)
                    console.log("Original CF Data Array:", cfHist)

                    const newHist = data.map(d => ({ ...d }))

                    // Helper to normalize slightly mismatched months like "Nov", "november", "11."
                    const normalizeMonth = (m: string) => {
                        if (!m) return ''
                        let clean = m.trim().toLowerCase()

                        const numMatch = clean.match(/^0?(\d{1,2})/)
                        if (numMatch) {
                            const num = parseInt(numMatch[1])
                            if (num >= 1 && num <= 12) return num.toString()
                        }

                        clean = clean.replace(/[^a-z0-9]/g, '')
                        // common slovenian/english mappings
                        if (clean.startsWith('jan')) return '1'
                        if (clean.startsWith('feb')) return '2'
                        if (clean.startsWith('mar')) return '3'
                        if (clean.startsWith('apr')) return '4'
                        if (clean.startsWith('maj') || clean.startsWith('may')) return '5'
                        if (clean.startsWith('jun')) return '6'
                        if (clean.startsWith('jul')) return '7'
                        if (clean.startsWith('avg') || clean.startsWith('aug')) return '8'
                        if (clean.startsWith('sep')) return '9'
                        if (clean.startsWith('okt') || clean.startsWith('oct')) return '10'
                        if (clean.startsWith('nov')) return '11'
                        if (clean.startsWith('dec') || clean.startsWith('des')) return '12'
                        return clean
                    }

                    const cfMap = new Map()
                    cfHist.forEach((c: any) => {
                        cfMap.set(normalizeMonth(c.month), Number(c.balance))
                    })

                    let lastKnownCF = 0

                    // Seeding the initial CF balance in case older CF months exist chronologically before our current chart starts
                    const firstMatchIndexInCF = cfHist.findIndex((c: any) =>
                        newHist.some(h => normalizeMonth(h.month) === normalizeMonth(c.month))
                    )

                    if (firstMatchIndexInCF > 0) {
                        lastKnownCF = Number(cfHist[firstMatchIndexInCF - 1].balance)
                        console.log(`Seeding initial CF balance from older month: €${lastKnownCF}`)
                    } else if (firstMatchIndexInCF === -1 && cfHist.length > 0) {
                        lastKnownCF = Number(cfHist[cfHist.length - 1].balance)
                        console.log(`No active CF months found in the last 6 months. Seeding from oldest known CF balance: €${lastKnownCF}`)
                    }

                    newHist.forEach(h => {
                        const normH = normalizeMonth(h.month)

                        if (cfMap.has(normH)) {
                            // Update our running CF balance since there's a new transaction this month
                            lastKnownCF = cfMap.get(normH)
                            console.log(`Month ${h.month}: Found CF transaction, updating running CF balance to €${lastKnownCF}`)
                        } else {
                            console.log(`Month ${h.month}: No CF transaction, carrying forward running CF balance of €${lastKnownCF}`)
                        }

                        const before = Number(h.balance)
                        h.balance = before + lastKnownCF
                        console.log(`-> Final merged month ${h.month}: Main(€${before}) + CF(€${lastKnownCF}) = €${h.balance}`)
                    })

                    console.log("Final Computed Array passed to Chart:", newHist)
                    console.groupEnd()

                    setChartData(newHist)
                }
            }
        } catch (e) {
            console.error("Error parsing CF history from local storage", e)
        }
    }, [data, augmentWithCF])

    if (!chartData || chartData.length === 0) return null

    // Custom Tooltip Formatter
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-card border border-border/50 p-3 rounded-xl shadow-lg">
                    <p className="text-muted-foreground text-xs mb-1 font-medium">{label}</p>
                    <p className="text-primary font-bold">
                        € {payload[0].value.toLocaleString('sl-SI', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            )
        }
        return null
    }

    // Derive filtered data based on selected time range
    const getDisplayedData = () => {
        if (!chartData) return []
        switch (timeRange) {
            case '3M': return chartData.slice(-3)
            case '6M': return chartData.slice(-6)
            case '1Y': return chartData.slice(-12)
            case 'ALL': return chartData
            default: return chartData.slice(-6)
        }
    }

    const displayedData = getDisplayedData()

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm mb-10"
        >
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="font-semibold text-lg text-foreground">Balance History</h3>
                    <p className="text-sm text-muted-foreground">Ending balance trending over time.</p>
                </div>

                {/* Time Range Filter Toggle */}
                <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50 w-fit">
                    {(['3M', '6M', '1Y', 'ALL'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${timeRange === range
                                    ? 'bg-background shadow-sm text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displayedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                {/* Fallback colors just in case CSS vars fail inside SVG gradient, but Tailwind primary usually is available */}
                                <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                        <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#9CA3AF', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#9CA3AF', fontSize: 12 }}
                            tickFormatter={(val) => `€${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '3 3' }} />
                        <Area
                            type="monotone"
                            dataKey="balance"
                            stroke="#d97706" // Amber 600
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorBalance)"
                            activeDot={{ r: 6, fill: "#d97706", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    )
}
