import { getSession } from '@/lib/session'
import { logoutAction } from '@/app/actions/auth'
import { FinanceSyncButton } from '@/components/FinanceSyncButton'
import { BalanceChart } from '@/components/BalanceChart'
import { Sidebar } from '@/components/Sidebar'
import { MetricCard } from '@/components/MetricCard'
import { CombinedCurrentBalanceCard } from '@/components/CombinedCurrentBalanceCard'
import { FolderKanban, LogOut, FileText, ArrowUpRight, TrendingUp, BarChart3, Euro } from 'lucide-react'
import { getFinanceDashboardMetrics } from '@/lib/google-sheets'
import Link from 'next/link'
import { CFBackgroundFetcher } from '@/components/CFBackgroundFetcher'

export default async function DashboardPage() {
  const session = await getSession()
  const metrics = await getFinanceDashboardMetrics()

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
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back, Majster</h1>
            <p className="text-muted-foreground">Here is what is happening with your business today.</p>
          </div>
        </header>

        {/* Highlight Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <CombinedCurrentBalanceCard baseBalanceStr={currentBalance} />
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
          <BalanceChart data={metrics.historicalBalances} augmentWithCF={true} />
        )}

        {/* Recent Transactions */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Recent Transactions
            </h3>
            <span className="text-sm text-muted-foreground mr-2">Latest 5 Records</span>
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
                {metrics?.rawData && metrics.rawData.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">{row.date}</td>
                    <td className="px-6 py-4 font-medium">{row.projectNumber}</td>
                    <td className="px-6 py-4 max-w-[200px] truncate" title={row.description}>{row.description}</td>
                    <td className="px-6 py-4 text-green-600 dark:text-green-500 font-medium">{row.income || '-'}</td>
                    <td className="px-6 py-4 text-red-600 dark:text-red-500 font-medium">{row.outcome || '-'}</td>
                    <td className="px-6 py-4 max-w-[150px] truncate" title={row.notes}>{row.notes}</td>
                    <td className="px-6 py-4">
                      {row.transactionUrl ? (
                        <Link href={row.transactionUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1">
                          Link <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
                {!metrics?.rawData || metrics.rawData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">No recent transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <FinanceSyncButton />
        <CFBackgroundFetcher />
      </main>
    </div>
  )
}
