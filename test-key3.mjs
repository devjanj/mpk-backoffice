import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
let key = process.env.GOOGLE_PRIVATE_KEY || '';
console.log("KEY MATCHES REGEX:", /^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----\n?$/.test(key));
console.log("LENGTH:", key.length);
console.log("FIRST 50 CHARS:", JSON.stringify(key.slice(0, 50)));
console.log("LAST 50 CHARS:", JSON.stringify(key.slice(-50)));
