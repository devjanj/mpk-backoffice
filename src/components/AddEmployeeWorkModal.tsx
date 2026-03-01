'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, UploadCloud, XCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AddEmployeeWorkModalProps {
    isOpen: boolean
    onClose: () => void
    existingProjectNumbers: string[]
    onSuccess?: () => void
}

export function AddEmployeeWorkModal({ isOpen, onClose, existingProjectNumbers, onSuccess }: AddEmployeeWorkModalProps) {
    const [employeeName, setEmployeeName] = useState<'Žan' | 'Jan' | 'Marko'>('Žan')
    const [date, setDate] = useState<string>('')
    const [hours, setHours] = useState<number | ''>('')
    const [payRate, setPayRate] = useState<number | ''>('')
    const [extraCosts, setExtraCosts] = useState<number | ''>('')
    const [projectNum, setProjectNum] = useState<string>('')
    const [description, setDescription] = useState<string>('')

    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    useEffect(() => {
        if (isOpen) {
            const today = new Date()
            const yyyy = today.getFullYear()
            const mm = String(today.getMonth() + 1).padStart(2, '0')
            const dd = String(today.getDate()).padStart(2, '0')
            setDate(`${yyyy}-${mm}-${dd}`)

            // Set default pay rates based on user maybe? Or leave blank
            setHours('')
            setPayRate(15) // Example default
            setExtraCosts('')
            setProjectNum('')
            setDescription('')
            setFile(null)
        }
    }, [isOpen])

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0])
        }
    }

    const handleSave = async () => {
        if (!date || !hours || !payRate) {
            alert('Please fill out Date, Hours, and Pay Rate.')
            return
        }

        setIsSaving(true)
        try {
            // Format date to DD.MM.YYYY
            const d = new Date(date)
            const formattedDate = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`

            const formData = new FormData()
            formData.append('employeeName', employeeName)
            formData.append('date', formattedDate)
            formData.append('hours', hours.toString())
            formData.append('payRate', payRate.toString())
            formData.append('extraCosts', (extraCosts || 0).toString())
            formData.append('projectNumber', projectNum)
            formData.append('description', description)
            if (file) {
                formData.append('file', file)
            }

            const res = await fetch('/api/employees/work', {
                method: 'POST',
                body: formData
            })

            const data = await res.json()
            if (data.success) {
                if (onSuccess) onSuccess();
                router.refresh()
                onClose()
            } else {
                alert(data.error || 'Failed to save entry')
            }
        } catch (error) {
            console.error('Save error', error)
            alert('An unexpected error occurred while saving the employee entry.')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl border border-border/50 overflow-hidden relative my-auto"
                        >
                            <div className="flex justify-between items-center p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    Track Employee Work
                                </h2>
                                <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                                    <X className="w-5 h-5 text-muted-foreground" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto max-h-[80vh]">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Employee</label>
                                        <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50">
                                            {(['Žan', 'Jan', 'Marko'] as const).map(emp => (
                                                <button
                                                    key={emp}
                                                    onClick={() => setEmployeeName(emp)}
                                                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${employeeName === emp ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    {emp}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Date</label>
                                        <input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-6 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">Hours <span className="text-red-500">*</span></label>
                                        <input
                                            type="number"
                                            value={hours}
                                            onChange={(e) => setHours(parseFloat(e.target.value))}
                                            placeholder="e.g. 8"
                                            className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">Pay Rate (€/h) <span className="text-red-500">*</span></label>
                                        <input
                                            type="number"
                                            value={payRate}
                                            onChange={(e) => setPayRate(parseFloat(e.target.value))}
                                            step="0.5"
                                            className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Extra Costs (€)</label>
                                        <input
                                            type="number"
                                            value={extraCosts}
                                            onChange={(e) => setExtraCosts(parseFloat(e.target.value))}
                                            placeholder="e.g. 15.50"
                                            className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Project Number</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={projectNum}
                                            onChange={(e) => setProjectNum(e.target.value.toUpperCase())}
                                            placeholder="e.g. 054_PRI, NoProj"
                                            className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 uppercase"
                                            list="employee-projects"
                                        />
                                        <datalist id="employee-projects">
                                            {existingProjectNumbers.map(p => <option key={p} value={p} />)}
                                        </datalist>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Short Description</label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="What was done today?"
                                        maxLength={80}
                                        className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>

                                <div className="space-y-2 mb-8">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Proof / Image Upload (Optional)</label>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={(e) => e.target.files && setFile(e.target.files[0])}
                                        className="hidden"
                                        accept="image/*,application/pdf"
                                    />

                                    {!file ? (
                                        <div
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/30 hover:bg-muted/50'}`}
                                        >
                                            <UploadCloud className={`w-10 h-10 mb-3 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                                            <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
                                            <p className="text-xs text-muted-foreground text-center">Images or PDFs matching the day's work.</p>
                                            <p className="text-[10px] text-muted-foreground/50 mt-4 uppercase tracking-widest font-semibold flex items-center gap-1">
                                                Saving to Drive: Employees
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-muted border border-border/50 rounded-2xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-10 h-10 bg-background rounded-lg border border-border/50 flex items-center justify-center shrink-0">
                                                    <span className="text-xs font-bold text-muted-foreground">{file.name.split('.').pop()?.toUpperCase()}</span>
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setFile(null)} className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors group">
                                                <XCircle className="w-5 h-5 opacity-50 group-hover:opacity-100" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 pt-6 border-t border-border/50">
                                    <button
                                        onClick={onClose}
                                        className="px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50"
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isSaving ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving Entry...</>
                                        ) : (
                                            'Save to Database & Sheet'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
