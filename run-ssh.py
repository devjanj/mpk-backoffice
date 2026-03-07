import paramiko
import time

host = "209.38.167.154"
user = "root"
password = "janeKjaneK12."

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Connecting to {host}...")
    ssh.connect(host, username=user, password=password, timeout=10)
    
    commands = [
        "node -v",
        "npm -v",
        "pm2 status",
        "ufw status",
        "ls -la /root/mpk-backoffice",
        "cat /root/mpk-backoffice/.env.local | head -n 3"
    ]
    
    for cmd in commands:
        print(f"\n--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode())
        err = stderr.read().decode()
        if err: print("ERROR:", err)
        
except Exception as e:
    print(f"Failed to connect or execute: {e}")
finally:
    ssh.close()
