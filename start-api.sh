#!/usr/bin/expect -f
set timeout 120
spawn ssh -o StrictHostKeyChecking=no root@209.38.167.154
expect "password: "
send "janeKjaneK12.\r"
expect "# "
send "cd /root/mpk-backoffice && npm install -g tsx && npm install\r"
expect "# "
send "pm2 delete mpk-api || true\r"
expect "# "
send "pm2 start \"npx tsx server.ts\" --name mpk-api\r"
expect "# "
send "pm2 save\r"
expect "# "
send "exit\r"
expect eof
