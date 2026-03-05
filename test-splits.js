import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const splits = await prisma.transactionSplit.findMany({
    where: { transactionHash: "fd5bd0287071db3e0245b3064480ade294799949d0943ade15c66ad602d93049" }
  })
  console.log("Remaining Splits for 136.13:\n", JSON.stringify(splits, null, 2))
}
main().catch(console.error).finally(() => prisma.$disconnect())
