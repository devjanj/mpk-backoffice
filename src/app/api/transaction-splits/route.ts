import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
    try {
        const splits = await prisma.transactionSplit.findMany({
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json({ success: true, data: splits })
    } catch (e: any) {
        return NextResponse.json({ error: e.message })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { transactionHash, projectNumber, amount, note } = body

        if (!transactionHash || !projectNumber || amount === undefined) {
            return NextResponse.json({ error: "Missing required split fields" })
        }

        const newSplit = await prisma.transactionSplit.create({
            data: {
                transactionHash,
                projectNumber,
                amount: parseFloat(amount),
                note
            }
        })

        return NextResponse.json({ success: true, data: newSplit })
    } catch (e: any) {
        return NextResponse.json({ error: e.message })
    }
}
