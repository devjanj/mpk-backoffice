import { syncCFSheet } from '@/lib/google-sheets'

async function checkCF() {
    console.log("Fetching new CF sheet...")
    const res = await syncCFSheet()
    if (!res.success) {
        console.error("Failed:", res.error)
        return
    }
    console.log(`Success! Fetched ${res.data?.length} CF records.`)
    if (res.data && res.data.length > 0) {
        console.log("First row:", res.data[0])
        console.log("Last row:", res.data[res.data.length - 1])
    }
}

checkCF()
