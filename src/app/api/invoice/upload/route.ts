import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        console.log(`[OCR] Incoming file: ${file.name} (${file.type})`)

        // 1. Convert Web File to ArrayBuffer -> Base64 for Gemini
        const arrayBuffer = await file.arrayBuffer()
        const base64Data = Buffer.from(arrayBuffer).toString('base64')

        // 2. Map mime types for Gemini API
        let mimeType = file.type
        // If the browser sends a generic octet-stream but it's a PDF, force the PDF mime type
        if (file.name.toLowerCase().endsWith('.pdf')) {
            mimeType = 'application/pdf'
        }

        // 3. Prepare the AI Prompt
        const prompt = `
            You are a highly accurate, structured data extraction engine operating for a carpentry business backoffice.
            Below is an image/PDF of an invoice or receipt.
            Please extract the following information. Be as accurate as possible. If a value is not explicitly found, return an empty string for text, or 0 for numbers.
            
            Strictly return ONLY a raw JSON object (do not wrap it in markdown block quotes like \`\`\`json) with the exact structure:
            {
                "amount": <number> (the total amount, e.g. 150.50),
                "tax": <number> (the tax amount, e.g. 33.11. If 0, return 0),
                "date": "<string>" (format strictly as DD.MM.YYYY),
                "description": "<string>" (A summarized description of the vendor/company and short list of items - max 60 chars)
            }
        `

        // 4. Execute the Gemini 2.5 Flash Model Vision Extraction
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            }
        ])

        const responseText = result.response.text()
        console.log(`[OCR] Raw AI Response:`, responseText)

        // 5. Clean and parse the JSON snippet safely
        // Sometimes LLMs still wrap in markdown despite prompt constraints
        const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim()

        let extractedData = {
            amount: 0,
            tax: 0,
            date: '',
            description: ''
        }

        try {
            extractedData = JSON.parse(cleanedText)
        } catch (jsonErr) {
            console.error('[OCR] Failed to parse JSON response cleanly', jsonErr)
            // We'll just return the empty structure if parsing completely fails 
        }

        return NextResponse.json({ success: true, data: extractedData })

    } catch (error: any) {
        console.error('[OCR] Extraction Error:', error)
        return NextResponse.json({ error: error.message || 'Failed to process file' }, { status: 500 })
    }
}
