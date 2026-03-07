#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@209.38.167.154
expect "password: "
send "janeKjaneK12.\r"
expect "# "
send "ufw allow 3001\r"
expect "# "
send "systemctl restart ufw || true\r"
expect "# "
send "exit\r"
expect eof
