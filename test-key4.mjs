import fs from 'fs';
const envContent = fs.readFileSync('.env.local', 'utf-8');
const match = envContent.match(/GOOGLE_PRIVATE_KEY="([\s\S]*?)"/);
console.log("ACTUAL ENV VAR LENGTH IN FILE:", match ? match[1].length : 0);
console.log("IS TERMINAL BLOCKING US?:", process.env.GOOGLE_PRIVATE_KEY !== undefined);
console.log("TERMINAL VALUE LENGTH:", (process.env.GOOGLE_PRIVATE_KEY || '').length);
