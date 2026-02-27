'use client'

import { useEffect } from "react"

export function parseEuropeanNumber(str: string): number {
    if (!str) return 0
    let cleaned = str.replace(/[^0-9.,-]/g, '')
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')

    if (lastComma > lastDot) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else if (lastDot > lastComma) {
        cleaned = cleaned.replace(/,/g, '')
    } else if (lastComma !== -1 && lastDot === -1) {
        cleaned = cleaned.replace(',', '.')
    }
    return parseFloat(cleaned) || 0
}

export function CFCacheManager({ currentBalanceStr, historyData, allData }: { currentBalanceStr: string, historyData: any[], allData?: any[] }) {
    useEffect(() => {
        if (!currentBalanceStr) return

        const num = parseEuropeanNumber(currentBalanceStr)
        localStorage.setItem('cf_balance_num', num.toString())
        localStorage.setItem('cf_history', JSON.stringify(historyData || []))

        if (allData && allData.length > 0) {
            localStorage.setItem('cf_all_data', JSON.stringify(allData))
        }
    }, [currentBalanceStr, historyData, allData])

    return null
}
