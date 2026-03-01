import { getSession } from '@/lib/session'
import { Sidebar } from '@/components/Sidebar'
import { MetricCard } from '@/components/MetricCard'
import { BalanceChart } from '@/components/BalanceChart'
import { CFCacheManager } from '@/components/CFCacheManager'
import { getCFDashboardMetrics } from '@/lib/google-sheets'
import { Euro, TrendingUp, BarChart3, Wallet, FileText, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { EarningsClientTable } from '@/components/EarningsClientTable'

export default async function CFEarningsPage() {
    const session = await getSession()
    const metrics = await getCFDashboardMetrics()

    // Format fallbacks
    const currentBalance = metrics?.currentBalance || "€ 0,00"

    const incomeCurrentFormatted = metrics
        ? `€ ${metrics.currentMonthIncome.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "€ 0,00"

    const previousIncomeFormatted = metrics
        ? `€ ${metrics.previousMonthIncome.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "€ 0,00"

    const incomeChangeFormatted = metrics?.percentageChange
        ? `${metrics.percentageChange > 0 ? '+' : ''}${metrics.percentageChange.toFixed(1)}%`
        : "0%"

    const isPositiveTrend = (metrics?.percentageChange || 0) >= 0;

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                <CFCacheManager currentBalanceStr={currentBalance} historyData={metrics?.historicalBalances || []} allData={metrics?.allRawData || []} />

                <header className="mb-10 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                            <Wallet className="w-8 h-8 text-primary" />
                            Off-the-Books (CF)
                        </h1>
                        <p className="text-muted-foreground">Earnings overview from the 02_FINANCE_COPY CF tab.</p>
                    </div>
                </header>

                {/* Highlight Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <MetricCard
                        title="Current Balance"
                        value={currentBalance}
                        trend="Live CF Balance"
                        icon={<Euro className="w-5 h-5 text-primary" />}
                    />
                    <MetricCard
                        title={`Income (${metrics?.currentMonthName || 'This Month'})`}
                        value={incomeCurrentFormatted}
                        trend={`${previousIncomeFormatted} in ${metrics?.previousMonthName || 'Previous Month'}`}
                        icon={<TrendingUp className={`w-5 h-5 ${isPositiveTrend ? 'text-green-500' : 'text-red-500'}`} />}
                    />
                    <MetricCard
                        title="% Change (MoM Income)"
                        value={incomeChangeFormatted}
                        trend={`Compared to ${metrics?.previousMonthName || 'last month'}`}
                        icon={<BarChart3 className={`w-5 h-5 ${isPositiveTrend ? 'text-green-500' : 'text-red-500'}`} />}
                    />
                </div>

                {/* Balance Chart */}
                {metrics?.historicalBalances && (
                    <BalanceChart data={metrics.historicalBalances} />
                )}

                {/* Interactive CF Transactions List */}
                <EarningsClientTable title="CF Transactions" transactions={metrics?.allRawData || []} />

            </main>
        </div>
    )
}
