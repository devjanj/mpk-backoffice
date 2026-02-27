import React from 'react'

export function MetricCard({ title, value, trend, icon }: { title: string, value: string, trend: string, icon: React.ReactNode }) {
    return (
        <div className="bg-card border border-border/50 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/5 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
            <div className="flex justify-between items-start mb-4 relative z-10">
                <h3 className="text-muted-foreground font-medium">{title}</h3>
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    {icon}
                </div>
            </div>
            <div className="relative z-10">
                <p className="text-3xl font-bold tracking-tight mb-1">{value}</p>
                <p className="text-sm font-medium text-muted-foreground">{trend}</p>
            </div>
        </div>
    )
}
