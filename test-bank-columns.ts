import { downloadSpreadsheet } from './src/lib/google-sheets';

async function main() {
    await downloadSpreadsheet();
    return;
}
main().catch(console.error);
