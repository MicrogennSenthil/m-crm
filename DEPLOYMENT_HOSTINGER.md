# Hostinger VPS Deployment Guide for M-CRM

This guide will help you deploy the M-CRM application to a Hostinger VPS.

## Prerequisites

- Hostinger VPS (KVM 2 or higher recommended - 2 vCPU, 8GB RAM)
- Ubuntu 22.04 LTS
- Domain: crm.microgenn.com pointed to your VPS IP

---

## Step 1: Initial VPS Setup

SSH into your VPS:
```bash
ssh root@YOUR_VPS_IP
```

Update system:
```bash
apt update && apt upgrade -y
```

Create a non-root user:
```bash
adduser mcrm
usermod -aG sudo mcrm
```

---

## Step 2: Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node --version  # Should show v20.x.x
```

---

## Step 3: Install PostgreSQL with pgvector

```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install pgvector extension
apt install -y postgresql-16-pgvector

# Or build from source if not available:
# apt install -y postgresql-server-dev-16 git build-essential
# git clone https://github.com/pgvector/pgvector.git
# cd pgvector && make && make install

# Start PostgreSQL
systemctl enable postgresql
systemctl start postgresql
```

Create database and user:
```bash
sudo -u postgres psql

-- In PostgreSQL prompt:
CREATE USER mcrm_user WITH PASSWORD 'YOUR_SECURE_PASSWORD';
CREATE DATABASE mcrm_db OWNER mcrm_user;
\c mcrm_db
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL PRIVILEGES ON DATABASE mcrm_db TO mcrm_user;
\q
```

---

## Step 4: Install PM2 & Nginx

```bash
npm install -g pm2
apt install -y nginx
```

---

## Step 5: Upload Application Files

On your local machine, download the project from Replit and upload to VPS:

```bash
# From Replit, download as ZIP or use Git
# Then upload to VPS:
scp -r ./mcrm-project mcrm@YOUR_VPS_IP:/home/mcrm/app
```

Or clone from Git (if you have a repository):
```bash
cd /home/mcrm
git clone YOUR_REPO_URL app
```

---

## Step 6: Configure Environment Variables

Create `.env` file:
```bash
cd /home/mcrm/app
nano .env
```

Add these variables:
```env
NODE_ENV=production
PORT=3000

# Database (PostgreSQL)
DATABASE_URL=postgresql://mcrm_user:YOUR_SECURE_PASSWORD@localhost:5432/mcrm_db

# Session
SESSION_SECRET=your-secure-session-secret-here

# Resend Email
RESEND_API_KEY=your-resend-api-key

# OpenAI (for Knowledge Base embeddings)
OPENAI_API_KEY=your-openai-api-key

# Object Storage (if using)
DEFAULT_OBJECT_STORAGE_BUCKET_ID=your-bucket-id
PUBLIC_OBJECT_SEARCH_PATHS=public
PRIVATE_OBJECT_DIR=.private
```

---

## Step 7: Build and Start Application

```bash
cd /home/mcrm/app

# Install dependencies
npm install

# Build for production
npm run build

# Push database schema
npm run db:push

# Start with PM2
pm2 start dist/index.js --name mcrm
pm2 save
pm2 startup
```

---

## Step 8: Configure Nginx Reverse Proxy

Create Nginx configuration:
```bash
nano /etc/nginx/sites-available/mcrm
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name crm.microgenn.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Handle large file uploads
    client_max_body_size 50M;
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/mcrm /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

---

## Step 9: Install SSL Certificate (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d crm.microgenn.com
```

Follow the prompts to complete SSL setup.

---

## Step 10: Configure Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## Step 11: Point Your Domain

In BigRock DNS settings, add an A record:
- **Type**: A
- **Host**: crm
- **Points to**: YOUR_VPS_IP
- **TTL**: 3600

---

## Maintenance Commands

### View logs:
```bash
pm2 logs mcrm
```

### Restart app:
```bash
pm2 restart mcrm
```

### Update app:
```bash
cd /home/mcrm/app
git pull  # if using Git
npm install
npm run build
pm2 restart mcrm
```

### Database backup:
```bash
pg_dump -U mcrm_user mcrm_db > backup_$(date +%Y%m%d).sql
```

---

## Troubleshooting

### Check if app is running:
```bash
pm2 status
curl http://localhost:3000/api/auth/user
```

### Check Nginx:
```bash
nginx -t
systemctl status nginx
```

### Check PostgreSQL:
```bash
systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"
```

### View application logs:
```bash
pm2 logs mcrm --lines 100
```

---

## Security Recommendations

1. **Change default SSH port** in `/etc/ssh/sshd_config`
2. **Disable root login** via SSH
3. **Set up fail2ban** for brute force protection
4. **Regular backups** of database and files
5. **Keep system updated** with `apt update && apt upgrade`
