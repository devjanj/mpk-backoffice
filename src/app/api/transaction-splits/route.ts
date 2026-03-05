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
        const { transactionHash, splits } = body

        if (!transactionHash || !Array.isArray(splits)) {
            return NextResponse.json({ error: "Missing required split fields or invalid format" })
        }

        // Delete existing splits for this hash to allow clean overriding/cancelling
        await prisma.transactionSplit.deleteMany({
            where: { transactionHash }
        })

        if (splits.length > 0) {
            await prisma.transactionSplit.createMany({
                data: splits.map((sp: any) => ({
                    transactionHash,
                    projectNumber: sp.projectNumber,
                    amount: sp.amount,
                    note: sp.note || ''
                }))
            })
        }

        return NextResponse.json({ success: true, message: "Splits successfully saved" })
    } catch (e: any) {
        return NextResponse.json({ error: e.message })
    }
}
