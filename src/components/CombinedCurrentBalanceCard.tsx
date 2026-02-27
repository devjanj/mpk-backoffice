'use client'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { Euro } from 'lucide-react'
import { parseEuropeanNumber } from '@/components/CFCacheManager'

export function CombinedCurrentBalanceCard({ baseBalanceStr }: { baseBalanceStr: string }) {
    const [balance, setBalance] = useState(baseBalanceStr)
    const [hasCF, setHasCF] = useState(false)

    useEffect(() => {
        const cfBalanceNumStr = localStorage.getItem('cf_balance_num')
        if (cfBalanceNumStr && cfBalanceNumStr !== '0') {
            const mainNum = parseEuropeanNumber(baseBalanceStr)
            const cfNum = parseFloat(cfBalanceNumStr)

            if (!isNaN(cfNum) && cfNum !== 0) {
                const total = mainNum + cfNum
                setBalance(`€ ${total.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                setHasCF(true)
            }
        }
    }, [baseBalanceStr])

    return (
        <MetricCard
            title="Current Balance"
            value={balance}
            trend={hasCF ? "Combined (Main + CF)" : "Live from Sheet"}
            icon={<Euro className="w-5 h-5 text-primary" />}
        />
    )
}
