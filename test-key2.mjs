import dotenv from 'dotenv';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const match = envContent.match(/GOOGLE_PRIVATE_KEY="(.*?)"/);
if (match) {
    console.log("RAW MATCH CONTAINS LITERAL \\n?", match[1].includes('\\n'));
} else {
    console.log("NO MATCH");
}

dotenv.config({ path: '.env.local' });
let key = process.env.GOOGLE_PRIVATE_KEY || '';
console.log("FROM DOTENV CONTAINS LITERAL \\n?", key.includes('\\n'));
