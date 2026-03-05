import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanDuplicates() {
    const allSplits = await prisma.transactionSplit.findMany({
        orderBy: { createdAt: 'desc' }
    });

    const hashMap = new Map();

    for (const split of allSplits) {
        if (!hashMap.has(split.transactionHash)) {
            hashMap.set(split.transactionHash, []);
        }
        hashMap.get(split.transactionHash).push(split);
    }

    let deletedCount = 0;

    for (const [hash, splits] of hashMap.entries()) {
        // splits are ordered by newest first
        // we want to keep the newest "set". 
        // Since the old bug saved them basically at the same time or within a minute,
        // let's look at the most recent split's createdAt time, and keep all splits that
        // were created within 5 seconds of it.

        if (splits.length === 0) continue;

        const newestTime = splits[0].createdAt.getTime();
        const keepIds = new Set();
        const deleteIds = [];

        // Assuming a "set" of splits was saved within a 2-second window of each other
        for (const sp of splits) {
            if (Math.abs(newestTime - sp.createdAt.getTime()) < 5000) {
                keepIds.add(sp.id);
            } else {
                deleteIds.push(sp.id);
            }
        }

        if (deleteIds.length > 0) {
            console.log(`Hash ${hash} - Keeping ${keepIds.size}, Deleting ${deleteIds.length} older duplicates.`);
            const res = await prisma.transactionSplit.deleteMany({
                where: { id: { in: deleteIds } }
            });
            deletedCount += res.count;
        }
    }

    console.log(`Cleanup complete. Deleted ${deletedCount} duplicated splits.`);
}

cleanDuplicates().catch(console.error).finally(() => prisma.$disconnect());
