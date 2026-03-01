'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, UploadCloud, XCircle, Loader2, FileCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { EmployeeWork } from './EmployeesDashboard'

interface AddEmployeeWorkModalProps {
    isOpen: boolean
    onClose: () => void
    existingProjectNumbers: string[]
    editData?: EmployeeWork | null
    onSuccess?: () => void
}

export function AddEmployeeWorkModal({ isOpen, onClose, existingProjectNumbers, editData, onSuccess }: AddEmployeeWorkModalProps) {
    const [employeeName, setEmployeeName] = useState<'Žan' | 'Jan' | 'Marko'>('Žan')
    const [date, setDate] = useState<string>('')
    const [hours, setHours] = useState<string>('')
    const [payRate, setPayRate] = useState<string>('')
    const [extraCosts, setExtraCosts] = useState<string>('')
    const [projectNum, setProjectNum] = useState<string>('')
    const [description, setDescription] = useState<string>('')

    const [files, setFiles] = useState<File[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    useEffect(() => {
        if (isOpen) {
            if (editData) {
                // Hydrate Edit Form
                setEmployeeName(editData.employeeName as 'Žan' | 'Jan' | 'Marko')
                const d = new Date(editData.date)
                const yyyy = d.getFullYear()
                const mm = String(d.getMonth() + 1).padStart(2, '0')
                const dd = String(d.getDate()).padStart(2, '0')
                setDate(`${yyyy}-${mm}-${dd}`)

                setHours(editData.hours.toString())
                setPayRate(editData.payRate.toString())
                setExtraCosts(editData.extraCosts ? editData.extraCosts.toString() : '')
                setProjectNum(editData.projectNumber || '')
                setDescription(editData.description || '')
                setFiles([])
            } else {
                // Clear Create Form
                const today = new Date()
                const yyyy = today.getFullYear()
                const mm = String(today.getMonth() + 1).padStart(2, '0')
                const dd = String(today.getDate()).padStart(2, '0')
                setDate(`${yyyy}-${mm}-${dd}`)

                setHours('')
                setPayRate('15')
                setExtraCosts('')
                setProjectNum('')
                setDescription('')
                setFiles([])
            }
        }
    }, [isOpen, editData])

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
            setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
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
            if (editData?.id) {
                formData.append('id', editData.id)
            }
            formData.append('employeeName', employeeName)
            formData.append('date', formattedDate)
            formData.append('hours', hours) // Keep as string for backend parsing
            formData.append('payRate', payRate) // Send as string to support commas
            formData.append('extraCosts', extraCosts || '0') // Send as string
            formData.append('projectNumber', projectNum)
            formData.append('description', description)
            files.forEach(f => {
                formData.append('file', f)
            })

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
                                    {editData ? 'Edit Employee Work' : 'Track Employee Work'}
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
                                            type="text"
                                            value={hours}
                                            onChange={(e) => setHours(e.target.value)}
                                            placeholder="e.g. 8.5 or 8,5"
                                            className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">Pay Rate (€/h) <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={payRate}
                                            onChange={(e) => setPayRate(e.target.value)}
                                            placeholder="e.g. 15,00"
                                            className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Extra Costs (€)</label>
                                        <input
                                            type="text"
                                            value={extraCosts}
                                            onChange={(e) => setExtraCosts(e.target.value)}
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
                                        onChange={(e) => {
                                            if (e.target.files) {
                                                setFiles(prev => [...prev, ...Array.from(e.target.files!)])
                                            }
                                        }}
                                        className="hidden"
                                        multiple
                                        accept="image/*,application/pdf,video/*"
                                    />

                                    <div className="space-y-3">
                                        <div
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden ${isDragging ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/30 hover:bg-muted/50'}`}
                                        >
                                            <UploadCloud className={`w-10 h-10 mb-3 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                                            <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
                                            <p className="text-xs text-muted-foreground text-center">Images, PDFs, or Videos matching the day's work.</p>

                                            {editData?.driveFileLink && files.length === 0 && (
                                                <div className="mt-4 flex flex-col items-center">
                                                    <div className="flex justify-center items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-semibold mb-2">
                                                        <FileCheck className="w-3.5 h-3.5" />
                                                        Current Proof Attached
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground/60 text-center">Uploading new files will replace the existing attachments.</p>
                                                </div>
                                            )}

                                            <p className="text-[10px] text-muted-foreground/50 mt-4 uppercase tracking-widest font-semibold flex items-center gap-1">
                                                Saving to Drive: Employees
                                            </p>
                                        </div>

                                        {files.length > 0 && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {files.map((f, i) => (
                                                    <div key={i} className="bg-muted border border-border/50 rounded-xl p-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="w-8 h-8 bg-background rounded-lg border border-border/50 flex items-center justify-center shrink-0">
                                                                <span className="text-[10px] font-bold text-muted-foreground">{f.name.split('.').pop()?.substring(0, 4).toUpperCase()}</span>
                                                            </div>
                                                            <div className="truncate">
                                                                <p className="text-xs font-medium truncate">{f.name}</p>
                                                                <p className="text-[10px] text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors group">
                                                            <XCircle className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
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
                                            <><Loader2 className="w-4 h-4 animate-spin" /> {editData ? 'Updating...' : 'Saving Entry...'}</>
                                        ) : (
                                            editData ? 'Update Entry' : 'Save to Database & Sheet'
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
