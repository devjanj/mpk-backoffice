import { getSession } from '@/lib/session'
import { logoutAction } from '@/app/actions/auth'
import { BalanceChart } from '@/components/BalanceChart'
import { MetricCard } from '@/components/MetricCard'
import { CombinedCurrentBalanceCard } from '@/components/CombinedCurrentBalanceCard'
import { FolderKanban, TrendingUp, BarChart3 } from 'lucide-react'
import { getFinanceDashboardMetrics, getCFDashboardMetrics } from '@/lib/google-sheets'
import Link from 'next/link'
import { CFBackgroundFetcher } from '@/components/CFBackgroundFetcher'
import { ActiveProjectsOverview } from '@/components/ActiveProjectsOverview'

export default async function DashboardPage() {
  const session = await getSession()
  const [metrics, cfMetrics] = await Promise.all([
    getFinanceDashboardMetrics(),
    getCFDashboardMetrics()
  ])

  // Aggregate Bank + CF Income for the Owners Overview
  const totalCurrentIncome = (metrics?.currentMonthIncome || 0) + (cfMetrics?.currentMonthIncome || 0)
  const totalPreviousIncome = (metrics?.previousMonthIncome || 0) + (cfMetrics?.previousMonthIncome || 0)

  let totalPercentageChange = 0
  if (totalPreviousIncome > 0) {
    totalPercentageChange = ((totalCurrentIncome - totalPreviousIncome) / totalPreviousIncome) * 100
  } else if (totalCurrentIncome > 0) {
    totalPercentageChange = 100
  }

  // Format fallbacks
  const currentBalance = metrics?.currentBalance || "€ 0,00"

  const incomeCurrentFormatted = `€ ${totalCurrentIncome.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const previousIncomeFormatted = `€ ${totalPreviousIncome.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const incomeChangeFormatted = `${totalPercentageChange > 0 ? '+' : ''}${totalPercentageChange.toFixed(1)}%`
  const isPositiveTrend = totalPercentageChange >= 0;

  return (
    <>
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

      {/* Active Projects Overview */}
      <ActiveProjectsOverview initialData={metrics?.allRawData || []} />

      <CFBackgroundFetcher />
    </>
  )
}
