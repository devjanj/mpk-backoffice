#!/usr/bin/expect -f
set timeout 30
spawn scp -o StrictHostKeyChecking=no /Users/janjagodnik/Documents/GitHub/mpk-backoffice/.env.local root@209.38.167.154:/root/mpk-backoffice/.env.local
expect "password: "
send "janeKjaneK12.\r"
expect eof
