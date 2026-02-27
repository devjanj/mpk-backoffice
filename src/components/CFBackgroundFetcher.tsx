'use client'

import { useEffect } from 'react'

import { fetchCFDataSilently } from '@/app/actions/finance'
import { parseEuropeanNumber } from '@/components/CFCacheManager'

export function CFBackgroundFetcher() {
    useEffect(() => {
        const fetchCF = async () => {
            try {
                // If we already have it cached, don't spam the API unnecessarily on every home click.
                if (localStorage.getItem('cf_all_data')) return;

                const res = await fetchCFDataSilently()
                if (res.success && res.allData) {
                    localStorage.setItem('cf_all_data', JSON.stringify(res.allData))
                    localStorage.setItem('cf_history', JSON.stringify(res.historyData || []))
                    if (res.currentBalanceStr) {
                        const num = parseEuropeanNumber(res.currentBalanceStr)
                        localStorage.setItem('cf_balance_num', num.toString())
                    }
                    console.log("Silently cached CF data")
                }
            } catch (err) {
                console.error("Silent CF fetch failed", err)
            }
        }

        fetchCF()
    }, [])

    return null
}
