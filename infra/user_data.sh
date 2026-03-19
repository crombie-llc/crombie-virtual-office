#!/bin/bash
# EC2 bootstrap script — runs once on first boot via Terraform user_data.
# Sets up: Node.js 20, pm2, Nginx, clones repo, builds and starts server.
set -e

# ── System packages ───────────────────────────────────────────────────────────
apt-get update && apt-get upgrade -y
apt-get install -y nginx certbot python3-certbot-nginx git curl

# ── Node.js 20 via NodeSource ─────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ── pm2 process manager ───────────────────────────────────────────────────────
npm install -g pm2

# ── Clone and build the server ────────────────────────────────────────────────
git clone https://github.com/crombie-llc/crombie-virtual-office.git /opt/crombie-office
cd /opt/crombie-office
npm ci --workspace=packages/server
npm run build --workspace=packages/server

# ── Start server under pm2 ───────────────────────────────────────────────────
PORT=3001 CORS_ORIGIN=https://office-app.coe.crombie.dev \
  pm2 start packages/server/dist/index.js --name crombie-office
pm2 save

# Enable pm2 on reboot
env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
systemctl enable pm2-ubuntu

# ── Nginx reverse proxy (HTTP only — Certbot adds HTTPS later) ────────────────
cat > /etc/nginx/sites-available/crombie-office << 'EOF'
server {
    listen 80;
    server_name office.coe.crombie.dev;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/crombie-office /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── NOTE ──────────────────────────────────────────────────────────────────────
# HTTPS (Let's Encrypt) must be configured AFTER DNS propagates.
# Once `terraform output ec2_ip` is pointed at by Route53, run manually:
#   ssh ubuntu@<ec2_ip> "sudo certbot --nginx -d office.coe.crombie.dev \
#     --non-interactive --agree-tos -m devops@crombie.dev"
