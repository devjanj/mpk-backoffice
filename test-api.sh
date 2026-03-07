#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@209.38.167.154
expect "password: "
send "janeKjaneK12.\r"
expect "# "
send "curl http://localhost:3001/api/invoice/upload || true\r"
expect "# "
send "exit\r"
expect eof
