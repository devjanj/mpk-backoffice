import { Client } from 'ssh2';
import * as fs from 'fs';

const conn = new Client();
const host = '209.38.167.154';
const username = 'root';
const password = 'janeKjaneK12.';

conn.on('ready', () => {
    console.log('SSH Ready. Executing Setup Commands...');

    const putFile = (local: string, remote: string) => {
        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err);
                console.log(`Uploading ${local} to ${remote}...`);
                sftp.fastPut(local, remote, (err) => {
                    if (err) {
                        console.error(`Failed to copy ${local}`, err);
                        resolve(false);
                    } else {
                        console.log(`Successfully copied ${local}`);
                        resolve(true);
                    }
                });
            });
        });
    }

    const runCommand = (cmd: string) => {
        return new Promise((resolve) => {
            console.log(`\n--- Running: ${cmd} ---`);
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('close', (code: any) => resolve(code))
                    .on('data', (data: any) => process.stdout.write(data))
                    .stderr.on('data', (data: any) => process.stderr.write(data));
            });
        });
    }

    const runAll = async () => {
        await runCommand('mkdir -p /root/mpk-backoffice');

        await putFile('/Users/janjagodnik/Documents/GitHub/mpk-backoffice/codebase.tar.gz', '/root/codebase.tar.gz');
        await putFile('/Users/janjagodnik/Documents/GitHub/mpk-backoffice/.env.local', '/root/mpk-backoffice/.env.local');

        console.log("Extracting Archive...");
        await runCommand('tar -xzf /root/codebase.tar.gz -C /root/mpk-backoffice');

        console.log("Installing Dependencies...");
        await runCommand('cd /root/mpk-backoffice && npm install');

        console.log("Configuring Firewall and PM2...");
        await runCommand('ufw allow 3001 && systemctl restart ufw || true');
        await runCommand('pm2 delete mpk-api || true');
        await runCommand('cd /root/mpk-backoffice && pm2 start "npx tsx server.ts" --name mpk-api');
        await runCommand('pm2 save');
        await runCommand('pm2 status');

        console.log("Configuration Complete!");
        conn.end();
    }

    runAll();

}).connect({ host, port: 22, username, password });
