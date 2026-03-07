import { Client } from 'ssh2';

const conn = new Client();
const host = '209.38.167.154';
const username = 'root';
const password = 'janeKjaneK12.';

conn.on('ready', () => {
    console.log('SSH Ready. Setting up Caddy...');

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
        // Install Caddy natively
        await runCommand('apt install -y debian-keyring debian-archive-keyring apt-transport-https');
        await runCommand("curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg");
        await runCommand("curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list");
        await runCommand('apt update');
        await runCommand('apt install caddy -y');

        // Configure Caddyfile for Reverse Proxy using sslip.io mapping to port 3001
        const caddyfileConfig = `209.38.167.154.sslip.io {\n    reverse_proxy localhost:3001\n}`;
        await runCommand(`echo "${caddyfileConfig}" > /etc/caddy/Caddyfile`);

        // Restart Caddy and enable Firewall ports for HTTP/HTTPS
        await runCommand('ufw allow 80');
        await runCommand('ufw allow 443');
        await runCommand('systemctl restart ufw || true');
        await runCommand('systemctl restart caddy');
        await runCommand('systemctl status caddy --no-pager');

        console.log("Caddy HTTPS Proxy Installation Complete!");
        conn.end();
    }

    runAll();

}).connect({ host, port: 22, username, password });
