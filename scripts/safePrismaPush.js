require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');

console.log("Environment loaded successfully. Running Prisma DB Push...");
try {
    execSync('npx --yes node@22 ./node_modules/.bin/prisma db push', { stdio: 'inherit' });
} catch (error) {
    console.error("Prisma failed to push.");
    process.exit(1);
}
