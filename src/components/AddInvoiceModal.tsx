'use client'

import { useState, useRef } from 'react'
import { Plus, UploadCloud, FileText, Image as ImageIcon, X, Loader2, CheckCircle2 } from 'lucide-react'

interface AddInvoiceModalProps {
    isOpen: boolean
    onClose: () => void
    existingProjectNumbers?: string[]
}

export function AddInvoiceModal({ isOpen, onClose, existingProjectNumbers = [] }: AddInvoiceModalProps) {
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [scanComplete, setScanComplete] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    // Invoice Form Fields
    const [source, setSource] = useState<'BANK' | 'CF'>('BANK')
    const [date, setDate] = useState('')
    const [amount, setAmount] = useState('')
    const [tax, setTax] = useState('')
    const [description, setDescription] = useState('')
    const [shortDescription, setShortDescription] = useState('')
    const [projectNum, setProjectNum] = useState('')
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false)

    // Filter project numbers
    const filteredProjects = existingProjectNumbers
        .filter(p => p && p.toLowerCase().includes(projectNum.toLowerCase()) && p !== projectNum)
        .slice(0, 5) // Show top 5 suggestions

    // Derived state
    const [originalProjectNumMatches, setOriginalProjectNumMatches] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return
        processFile(selectedFile)
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        const droppedFile = e.dataTransfer.files?.[0]
        if (!droppedFile) return
        processFile(droppedFile)
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
    }

    const processFile = async (file: File) => {
        setFile(file)

        // Setup local preview for images and PDFs
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)

        // Execute True AI Processing OCR
        setIsProcessing(true)
        setScanComplete(false)
        setUploadProgress(0)

        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch('/api/invoice/upload', {
                method: 'POST',
                body: formData
            })

            const json = await res.json()

            if (json.success && json.data) {
                if (json.data.date) setDate(json.data.date)
                if (json.data.amount) setAmount(String(json.data.amount))
                if (json.data.tax) setTax(String(json.data.tax))
                if (json.data.description) setDescription(String(json.data.description))
            } else {
                console.error("OCR Extraction Issue:", json.error)
            }
        } catch (error) {
            console.error("Failed to process OCR on file stream:", error)
        } finally {
            setIsProcessing(false)
            setScanComplete(true)
        }
    }

    const clearFile = () => {
        setFile(null)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        setScanComplete(false)
        setDate('')
        setAmount('')
        setTax('')
        setDescription('')
        setShortDescription('')
        setProjectNum('')
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleSave = async () => {
        if (!file) return

        setUploadProgress(10)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('source', source)
            formData.append('date', date)
            formData.append('projectNum', projectNum)
            formData.append('amount', amount)
            formData.append('tax', tax)
            formData.append('description', description)
            formData.append('shortDescription', shortDescription)

            setUploadProgress(50) // Simulating intermediate progress

            const res = await fetch('/api/invoice/save', {
                method: 'POST',
                body: formData
            })

            const json = await res.json()

            if (json.success) {
                setUploadProgress(100)
                setTimeout(() => {
                    onClose()
                    clearFile()
                }, 700)
            } else {
                console.error("Save Error:", json.error)
                alert("Failed to save invoice: " + json.error)
                setUploadProgress(0)
            }

        } catch (error) {
            console.error("Upload failure:", error)
            alert("Failed to reach server")
            setUploadProgress(0)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div
                className="bg-card w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-border/50 animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-border/50 bg-muted/10">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">Upload Invoice</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Drop a PDF or image. AI will automatically extract the core details.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row h-[600px] max-h-[70vh]">

                    {/* Left Pane: Uploader & Preview */}
                    <div className="flex-1 border-r border-border/50 bg-muted/5 flex flex-col p-6">
                        {!file ? (
                            <div
                                className="flex-1 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-8 text-center hover:bg-muted/30 transition-colors cursor-pointer group"
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                            >
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <UploadCloud className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-lg font-medium mb-2">Click or drag file back</h3>
                                <p className="text-sm text-muted-foreground max-w-xs">
                                    Supports PDF, JPG, PNG up to 10MB.
                                </p>
                                <input
                                    type="file"
                                    className="hidden"
                                    ref={fileInputRef}
                                    accept="application/pdf,image/jpeg,image/png"
                                    onChange={handleFileChange}
                                />
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col relative rounded-2xl overflow-hidden border border-border bg-card">
                                {/* Clear Button */}
                                <button
                                    onClick={clearFile}
                                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                {previewUrl && file.type === 'application/pdf' ? (
                                    <div className="flex-1 w-full h-full flex flex-col p-4 bg-muted/10">
                                        {/* Using object or iframe to embed native browser PDF viewer */}
                                        <iframe src={previewUrl} className="w-full h-full rounded-lg shadow-sm border border-border" title="PDF Preview" />
                                    </div>
                                ) : previewUrl && file.type.startsWith('image/') ? (
                                    <div className="flex-1 bg-black/5 flex items-center justify-center p-4">
                                        <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain shadow-sm rounded-lg" />
                                    </div>
                                ) : (
                                    <div className="flex-1 bg-muted/20 flex flex-col items-center justify-center p-8 text-center">
                                        <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
                                        <h3 className="font-medium truncate max-w-[250px]">{file.name}</h3>
                                        <p className="text-sm text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB PDF Document</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Pane: AI Data Extraction */}
                    <div className="w-full md:w-[400px] flex flex-col p-6 overflow-y-auto">

                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                Invoice Data
                                {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                                {scanComplete && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </h3>

                            {/* Source Toggle */}
                            <div className="flex p-1 bg-muted rounded-xl">
                                <button
                                    onClick={() => setSource('BANK')}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${source === 'BANK' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    Bank (Main)
                                </button>
                                <button
                                    onClick={() => setSource('CF')}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${source === 'CF' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    CF (Cash)
                                </button>
                            </div>
                        </div>

                        <div className={`space-y-4 transition-opacity duration-300 ${!file ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>

                            {/* Project Number (Manual / Autocomplete) */}
                            <div className="relative">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                                    Project Number
                                </label>
                                <input
                                    type="text"
                                    value={projectNum}
                                    onChange={(e) => {
                                        setProjectNum(e.target.value)
                                        setIsProjectDropdownOpen(true)
                                    }}
                                    onFocus={() => setIsProjectDropdownOpen(true)}
                                    // Delay blur so click event on dropdown fires first
                                    onBlur={() => setTimeout(() => setIsProjectDropdownOpen(false), 200)}
                                    placeholder="e.g. 5626 or RU35"
                                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                                />
                                {isProjectDropdownOpen && filteredProjects.length > 0 && (
                                    <ul className="absolute z-10 w-full mt-1 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2">
                                        {filteredProjects.map((proj, idx) => (
                                            <li
                                                key={idx}
                                                onClick={() => {
                                                    setProjectNum(proj)
                                                    setIsProjectDropdownOpen(false)
                                                }}
                                                className="px-4 py-2 text-sm hover:bg-muted font-mono cursor-pointer transition-colors"
                                            >
                                                {proj}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Date */}
                            <div>
                                <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider mb-1.5">
                                    Date <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full normal-case tracking-normal">AI Extracted</span>
                                </label>
                                <input
                                    type="text"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    placeholder="DD.MM.YYYY"
                                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Amount */}
                                <div>
                                    <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider mb-1.5">
                                        Total Amount
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-background border border-border/50 rounded-xl pl-4 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                                    </div>
                                </div>

                                {/* Tax */}
                                <div>
                                    <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider mb-1.5">
                                        Tax / DDV
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={tax}
                                            onChange={(e) => setTax(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-background border border-border/50 rounded-xl pl-4 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider mb-1.5">
                                    Description / Vendor
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={2}
                                    placeholder="Company Name / General category..."
                                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                                />
                            </div>

                            {/* Short/Item Description */}
                            <div>
                                <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider mb-1.5">
                                    Short Description (Items mapped to Column H)
                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full normal-case tracking-normal">New</span>
                                </label>
                                <input
                                    type="text"
                                    value={shortDescription}
                                    onChange={(e) => setShortDescription(e.target.value)}
                                    placeholder="e.g. Screws, Wood, Glue..."
                                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="mt-auto pt-6">
                            <button
                                onClick={handleSave}
                                disabled={!file || isProcessing || uploadProgress > 0}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl py-3 px-4 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden"
                            >
                                {uploadProgress > 0 && (
                                    <div
                                        className="absolute left-0 top-0 bottom-0 bg-black/10 transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                )}

                                {uploadProgress > 0 ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving to Google Drive & DB... {uploadProgress}%
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Save Invoice to {source}
                                    </>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}
