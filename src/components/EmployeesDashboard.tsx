'use client'

import React, { useState } from 'react'
import { Plus, Trash2, Calendar, FileText, Pickaxe, Euro, LinkIcon, FolderKanban, Pencil } from 'lucide-react'
import { AddEmployeeWorkModal } from './AddEmployeeWorkModal'
import { useRouter } from 'next/navigation'

export interface EmployeeWork {
    id: string
    employeeName: string
    date: Date
    hours: number
    payRate: number
    extraCosts: number | null
    projectNumber: string | null
    description: string | null
    driveFileId: string | null
    driveFileLink: string | null
}

interface EmployeesDashboardProps {
    initialData: EmployeeWork[]
    existingProjectNumbers: string[]
}

export function EmployeesDashboard({ initialData, existingProjectNumbers }: EmployeesDashboardProps) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<EmployeeWork | null>(null)
    const [data, setData] = useState<EmployeeWork[]>(initialData)
    const router = useRouter()

    const employees = ['Žan', 'Jan', 'Marko']

    const handleDelete = async (id: string, driveLink: string | null) => {
        if (!confirm('Are you sure you want to delete this time entry? This will permanently remove it from the Database, Google Drive, and Google Sheets.')) return;

        try {
            const res = await fetch('/api/employees/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, driveFileLink: driveLink })
            })

            const responseData = await res.json()
            if (responseData.success) {
                // Optimistically remove from UI
                setData(prev => prev.filter(r => r.id !== id))
                router.refresh()
            } else {
                alert(responseData.error || 'Failed to delete')
            }
        } catch (error) {
            alert('Failed to delete entry.')
        }
    }

    const formatDate = (date: Date) => {
        const d = new Date(date)
        return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`
    }

    const calculateTotal = (entry: EmployeeWork) => {
        return (entry.hours * entry.payRate) + (entry.extraCosts || 0)
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-end">
                <button
                    onClick={() => {
                        setEditingEntry(null)
                        setIsAddModalOpen(true)
                    }}
                    className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                >
                    <Plus className="w-5 h-5" /> Add New Entry
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {employees.map(employee => {
                    // Filter and strictly sort by date descending
                    const entries = data
                        .filter(e => e.employeeName === employee)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

                    // Calculate running totals
                    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
                    const totalPay = entries.reduce((sum, e) => sum + calculateTotal(e), 0)

                    return (
                        <div key={employee} className="bg-card border border-border/50 rounded-3xl overflow-hidden flex flex-col h-[800px]">
                            {/* Column Header */}
                            <div className="p-6 border-b border-border/50 bg-muted/20 shrink-0">
                                <h2 className="text-2xl font-bold mb-4">{employee}</h2>
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg">
                                        {totalHours.toFixed(1)} hrs total
                                    </span>
                                    <span className="text-emerald-500 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg">
                                        € {totalPay.toLocaleString('sl-SI', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Column Body / Cards */}
                            <div className="p-4 overflow-y-auto flex-1 space-y-4">
                                {entries.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                                        <Pickaxe className="w-12 h-12 mb-3 opacity-20" />
                                        <p>No tracked inputs yet.</p>
                                    </div>
                                ) : (
                                    entries.map(entry => (
                                        <div key={entry.id} className="bg-background border border-border/40 hover:border-border transition-colors p-5 rounded-2xl shadow-sm group relative">

                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2 text-primary font-bold">
                                                    <Calendar className="w-4 h-4 opacity-70" />
                                                    {formatDate(entry.date)}
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setEditingEntry(entry)
                                                            setIsAddModalOpen(true)
                                                        }}
                                                        className="p-2 text-primary hover:bg-primary/10 rounded-lg shrink-0"
                                                        title="Edit Entry"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(entry.id, entry.driveFileLink)}
                                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg shrink-0"
                                                        title="Delete Entry"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-y-3 mb-4 text-sm">
                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Hours</p>
                                                    <p className="font-medium">{entry.hours}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Rate</p>
                                                    <p className="font-medium flex items-center gap-1 opacity-80"><Euro className="w-3 h-3" />{entry.payRate}/h</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Extras</p>
                                                    <p className="font-medium">{entry.extraCosts ? `€ ${entry.extraCosts}` : '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Total</p>
                                                    <p className="font-bold text-emerald-500 flex items-center gap-1">€ {calculateTotal(entry).toLocaleString('sl-SI', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>

                                            {(entry.projectNumber || entry.description) && (
                                                <div className="pt-3 border-t border-border/50 text-sm space-y-2 mb-3">
                                                    {entry.projectNumber && (
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <FolderKanban className="w-4 h-4 shrink-0" />
                                                            <span className="font-semibold text-foreground bg-muted px-2 py-0.5 rounded uppercase tracking-wider text-xs">{entry.projectNumber}</span>
                                                        </div>
                                                    )}
                                                    {entry.description && (
                                                        <div className="flex items-start gap-2 text-muted-foreground">
                                                            <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                                                            <span className="line-clamp-2" title={entry.description}>{entry.description}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {entry.driveFileLink && (
                                                <div className="pt-3">
                                                    <a
                                                        href={entry.driveFileLink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center justify-center gap-2 w-full py-2 bg-primary/10 text-primary font-semibold rounded-xl hover:bg-primary/20 transition-colors text-sm"
                                                    >
                                                        <LinkIcon className="w-4 h-4" /> View Document
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <AddEmployeeWorkModal
                isOpen={isAddModalOpen}
                onClose={() => {
                    setIsAddModalOpen(false)
                    setTimeout(() => setEditingEntry(null), 300) // Clear after modal out-animates
                }}
                existingProjectNumbers={existingProjectNumbers}
                editData={editingEntry}
                onSuccess={() => {
                    // Refresh is handled inside modal via router.refresh, but we could trigger refetch here if needed
                }}
            />
        </div>
    )
}
