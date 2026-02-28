import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

let customPrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';
console.log("RAW FROM ENV:", JSON.stringify(customPrivateKey.slice(0, 50)));

if (customPrivateKey.startsWith('"') && customPrivateKey.endsWith('"')) {
    try { 
        customPrivateKey = JSON.parse(customPrivateKey); 
        console.log("Parsed with JSON.parse");
    } catch (e) { 
        customPrivateKey = customPrivateKey.slice(1, -1); 
        console.log("Pared with slice");
    }
}
customPrivateKey = customPrivateKey.replace(/\\n/g, '\n');

console.log("FINAL STRING STARTS WITH:", JSON.stringify(customPrivateKey.slice(0, 50)));
console.log("FINAL STRING CONTAINS REAL NEWLINES?", customPrivateKey.includes('\n'));
console.log("FINAL STRING CONTAINS LITERAL \\n?", customPrivateKey.includes('\\n'));
