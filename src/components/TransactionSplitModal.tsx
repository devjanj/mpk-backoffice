'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FinanceRow } from '@/lib/google-sheets'
import { X, Plus, Trash2, Save, ArrowRight, FileText } from 'lucide-react'
import { parseEuropeanNumber } from '@/components/CFCacheManager'

export function TransactionSplitModal({
    transaction,
    existingSplits,
    isOpen,
    onClose,
    onSave
}: {
    transaction: FinanceRow | null,
    existingSplits: any[],
    isOpen: boolean,
    onClose: () => void,
    onSave: () => void
}) {
    // Array of { projectNumber, amount, note }
    const [splits, setSplits] = useState<{ projectNumber: string, amount: string, note: string }[]>([])
    const [isSaving, setIsSaving] = useState(false)

    // Calculate total money available to split from the master transaction
    const maxAmount = parseFloat(transaction?.outcome?.replace(/[^0-9.,-]/g, '').replace(',', '.') || '0') ||
        parseFloat(transaction?.income?.replace(/[^0-9.,-]/g, '').replace(',', '.') || '0')

    const currentAllocated = splits.reduce((sum, s) => sum + (parseFloat(s.amount.replace(',', '.')) || 0), 0)
    const remaining = maxAmount - currentAllocated

    const previewUrl = useMemo(() => {
        if (!transaction?.transactionUrl) return null;
        const url = transaction.transactionUrl;
        if (url.includes('drive.google.com/file/d/')) {
            const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                return `https://drive.google.com/file/d/${match[1]}/preview`;
            }
        }
        return null;
    }, [transaction?.transactionUrl]);

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen && transaction) {
            if (existingSplits.length > 0) {
                setSplits(existingSplits.map(s => ({
                    projectNumber: s.projectNumber,
                    amount: s.amount.toString(),
                    note: s.note || ''
                })))
            } else {
                // Start with 1 empty split row
                setSplits([{ projectNumber: '', amount: maxAmount.toString(), note: '' }])
            }
        }
    }, [isOpen, transaction, existingSplits, maxAmount])

    const handleAddSplit = () => {
        setSplits([...splits, { projectNumber: '', amount: Math.max(0, remaining).toString(), note: '' }])
    }

    const handleRemoveSplit = (idx: number) => {
        setSplits(splits.filter((_, i) => i !== idx))
    }

    const handleUpdateSplit = (idx: number, field: string, value: string) => {
        const newSplits = [...splits]
        newSplits[idx] = { ...newSplits[idx], [field]: value }
        setSplits(newSplits)
    }

    const handleSave = async () => {
        if (!transaction?.id) return
        if (remaining < -0.01) {
            alert(`You have allocated €${Math.abs(remaining).toFixed(2)} MORE than the total transaction amount. Please adjust.`)
            return
        }

        setIsSaving(true)
        try {
            // Because we don't have a bulk overwrite API yet, for simplicity, we first need to delete existing
            // But since the API currently only does POST, we will just blindly append them for now. 
            // Better DB Sync logic required for production edits.

            for (const sp of splits) {
                if (!sp.projectNumber || !sp.amount) continue;

                await fetch('/api/transaction-splits', {
                    method: 'POST',
                    body: JSON.stringify({
                        transactionHash: transaction.id,
                        projectNumber: sp.projectNumber,
                        amount: sp.amount.replace(',', '.'), // Normalize comma decimals for DB
                        note: sp.note
                    })
                })
            }
            onSave() // Trigger parent refresh
            onClose()
        } catch (e) {
            alert('Failed to save splits')
        }
        setIsSaving(false)
    }

    if (!isOpen || !transaction) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    className={`bg-card w-full ${previewUrl ? 'max-w-6xl' : 'max-w-2xl'} rounded-3xl border border-border/50 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300`}
                >
                    <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
                        <div>
                            <h2 className="text-xl font-bold">Split Transaction Costs</h2>
                            <p className="text-sm text-muted-foreground mt-1">Allocate this Excel transaction to multiple projects</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        <div className={`flex flex-col flex-1 overflow-y-auto ${previewUrl ? 'md:w-1/2 md:border-r border-border/50' : 'w-full'}`}>
                            <div className="p-6 space-y-6 flex-1">
                                {/* Transaction Context Card */}
                                <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-sm font-semibold text-primary">{transaction.date}</span>
                                        <span className="text-lg font-black text-foreground">Total: € {maxAmount.toFixed(2)}</span>
                                    </div>

                                    {transaction.projectNumber && transaction.projectNumber !== '-' && (
                                        <div className="mb-2">
                                            <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap">
                                                Original Projects: {transaction.projectNumber}
                                            </span>
                                        </div>
                                    )}

                                    <p className="text-foreground font-medium">{transaction.description}</p>
                                    {transaction.notes && <p className="text-sm text-muted-foreground mt-1">{transaction.notes}</p>}
                                </div>

                                {/* Splitting Form */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Project Allocations</h3>
                                        <div className={`text-sm font-bold px-3 py-1 rounded-full ${remaining === 0 ? 'bg-emerald-500/10 text-emerald-500' : remaining < 0 ? 'bg-red-500/10 text-red-500' : 'bg-accent/10 text-accent'}`}>
                                            {remaining === 0 ? 'Perfectly Split' : remaining < 0 ? `Over by €${Math.abs(remaining).toFixed(2)}` : `€${remaining.toFixed(2)} Remaining`}
                                        </div>
                                    </div>

                                    {splits.map((split, i) => (
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            key={i}
                                            className="flex items-center gap-3 bg-muted/30 p-3 rounded-2xl border border-border/50"
                                        >
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Project #</label>
                                                <input
                                                    value={split.projectNumber}
                                                    onChange={(e) => handleUpdateSplit(i, 'projectNumber', e.target.value)}
                                                    placeholder="e.g. 238"
                                                    className="w-full bg-background border border-border/50 text-foreground text-sm rounded-xl px-3 py-2 outline-none focus:border-primary transition-all"
                                                />
                                            </div>
                                            <div className="w-32 space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Amount (€)</label>
                                                <input
                                                    value={split.amount}
                                                    onChange={(e) => handleUpdateSplit(i, 'amount', e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full bg-background border border-border/50 text-foreground text-sm rounded-xl px-3 py-2 outline-none focus:border-primary transition-all"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Note (Optional)</label>
                                                <input
                                                    value={split.note}
                                                    onChange={(e) => handleUpdateSplit(i, 'note', e.target.value)}
                                                    placeholder="Material costs..."
                                                    className="w-full bg-background border border-border/50 text-foreground text-sm rounded-xl px-3 py-2 outline-none focus:border-primary transition-all"
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleRemoveSplit(i)}
                                                disabled={splits.length === 1}
                                                className="mt-5 p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-30"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    ))}

                                    <button
                                        onClick={handleAddSplit}
                                        className="w-full py-3 border border-dashed border-border flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground rounded-2xl transition-all"
                                    >
                                        <Plus className="w-4 h-4" /> Add Split Target
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 border-t border-border/50 bg-muted/10 flex justify-end gap-3 shrink-0">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 rounded-xl font-medium text-muted-foreground hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || remaining < 0}
                                    className="px-6 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? 'Saving map...' : (
                                        <>Save Database Allocations <ArrowRight className="w-4 h-4" /></>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Right Side: Preview Iframe */}
                        {previewUrl && (
                            <div className="w-full md:w-1/2 bg-muted/20 flex flex-col h-[50vh] md:h-auto shrink-0 md:shrink">
                                <div className="flex items-center justify-between p-4 border-b border-border/50 bg-card shrink-0">
                                    <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                        <FileText className="w-4 h-4" /> Attached Document
                                    </span>
                                    <a href={transaction?.transactionUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                        Open in new tab <ArrowRight className="w-3 h-3" />
                                    </a>
                                </div>
                                <iframe
                                    src={previewUrl}
                                    className="w-full flex-1 border-none bg-black/5"
                                    allow="autoplay"
                                />
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
