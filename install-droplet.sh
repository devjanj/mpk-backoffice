#!/usr/bin/expect -f
set timeout 60
spawn ssh -o StrictHostKeyChecking=no root@209.38.167.154
expect "password: "
send "janeKjaneK12.\r"
expect "# "
send "apt update && apt install -y git curl\r"
expect "# "
send "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -\r"
expect "# "
send "apt install -y nodejs\r"
expect "# "
send "npm install -g pm2\r"
expect "# "
send "git clone https://github.com/JanJagodnik/mpk-backoffice.git /root/mpk-backoffice || (cd /root/mpk-backoffice && git fetch && git reset --hard origin/main)\r"
expect "# "
send "cd /root/mpk-backoffice && npm install\r"
expect "# "
send "exit\r"
expect eof
