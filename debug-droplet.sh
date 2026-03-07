#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@209.38.167.154
expect "password: "
send "janeKjaneK12.\r"
expect "# "
send "pm2 status\r"
expect "# "
send "ufw status\r"
expect "# "
send "netstat -tuln | grep 3001\r"
expect "# "
send "node -v\r"
expect "# "
send "exit\r"
expect eof
