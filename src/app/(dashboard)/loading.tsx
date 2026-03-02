import { Loader2 } from 'lucide-react'

export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center w-full h-[80vh] animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-primary/20">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Fetching Data...</h2>
            <p className="text-muted-foreground text-center max-w-[300px]">
                Synchronizing with Google Sheets and the PostgreSQL secure ledger.
            </p>
        </div>
    )
}
