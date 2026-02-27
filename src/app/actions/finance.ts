'use server'

import { getCFDashboardMetrics } from '@/lib/google-sheets'

export async function fetchCFDataSilently() {
    try {
        const data = await getCFDashboardMetrics()
        if (data) {
            return {
                success: true,
                historyData: data.historicalBalances,
                allData: data.allRawData,
                currentBalanceStr: data.currentBalance
            }
        }
        return { success: false }
    } catch (e) {
        return { success: false }
    }
}
