# M-CRM VPS Deployment Guide

This guide covers deploying M-CRM to an Ubuntu VPS server with your existing database and data.

---

## Quick Start (Automated)

We provide automated scripts for deployment:

### Step 1: Export Database (Run on Replit)
```bash
./export-database.sh
```

### Step 2: Deploy to VPS (Run on your VPS as root)
```bash
# Upload the script to your VPS
scp deploy-vps.sh root@your-server-ip:/root/

# SSH to your server and run
ssh root@your-server-ip
chmod +x /root/deploy-vps.sh
/root/deploy-vps.sh
```

The script will guide you through the entire setup process interactively.

---

## Manual Deployment

If you prefer manual setup, follow the steps below.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#1-server-setup)
3. [Export Current Database](#2-export-current-database)
4. [Setup PostgreSQL on VPS](#3-setup-postgresql-on-vps)
5. [Deploy Application](#4-deploy-application)
6. [Configure Environment](#5-configure-environment)
7. [Setup PM2](#6-setup-pm2)
8. [Configure Nginx](#7-configure-nginx)
9. [Setup SSL](#8-setup-ssl)
10. [Verification](#9-verification)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **VPS Server**: Ubuntu 22.04 LTS with minimum 2GB RAM
- **Domain Name**: Pointed to your VPS IP address
- **SSH Access**: Root or sudo access

---

## 1. Server Setup

### Connect to VPS
```bash
ssh root@your-server-ip
```

### Update System
```bash
apt update && apt upgrade -y
```

### Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node -v  # Should show v20.x.x
```

### Install PostgreSQL 16 with pgvector
```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
apt update

# Install PostgreSQL and pgvector extension
apt install -y postgresql-16 postgresql-contrib-16 postgresql-16-pgvector

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql
```

### Install PM2 and Nginx
```bash
npm install -g pm2
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

---

## 2. Export Current Database

### From Replit Console or Local Machine

Get your current DATABASE_URL and run:

```bash
# Export in custom format (recommended)
pg_dump "postgresql://username:password@host:port/database" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -F c \
  -f mcrm_backup.dump

# Alternative: SQL format
pg_dump "postgresql://username:password@host:port/database" \
  --no-owner \
  --no-acl \
  > mcrm_backup.sql
```

### Transfer to VPS
```bash
scp mcrm_backup.dump root@your-server-ip:/root/
```

---

## 3. Setup PostgreSQL on VPS

### Create Database and User
```bash
sudo -u postgres psql
```

```sql
-- Create user (use a strong password!)
CREATE USER mcrm_user WITH PASSWORD 'YOUR_STRONG_PASSWORD_HERE';

-- Create database
CREATE DATABASE mcrm_db OWNER mcrm_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE mcrm_db TO mcrm_user;

-- Connect and enable pgvector (REQUIRED for Knowledge Base)
\c mcrm_db
CREATE EXTENSION IF NOT EXISTS vector;

\q
```

### Import Data
```bash
# Using custom format (.dump)
pg_restore -U mcrm_user -d mcrm_db -h localhost --no-owner --no-acl /root/mcrm_backup.dump

# OR using SQL format
psql -U mcrm_user -d mcrm_db -h localhost -f /root/mcrm_backup.sql
```

### Verify Import
```bash
sudo -u postgres psql -d mcrm_db -c "\dt"
sudo -u postgres psql -d mcrm_db -c "SELECT COUNT(*) FROM users;"
sudo -u postgres psql -d mcrm_db -c "SELECT COUNT(*) FROM knowledge_base_chunks;"
```

---

## 4. Deploy Application

### Create Application Directory
```bash
mkdir -p /var/www/mcrm
mkdir -p /var/log/mcrm
cd /var/www/mcrm
```

### Option A: Git Clone (if using Git)
```bash
git clone YOUR_REPO_URL .
```

### Option B: Upload from Replit
1. Download project as ZIP from Replit
2. Upload and extract:
```bash
scp mcrm-project.zip root@your-server-ip:/var/www/mcrm/
cd /var/www/mcrm
unzip mcrm-project.zip
```

### Install Dependencies and Build
```bash
cd /var/www/mcrm
npm install
npm run build
```

---

## 5. Configure Environment

### Create Environment File
```bash
nano /var/www/mcrm/.env
```

### Required Environment Variables

```env
# ===========================================
# DATABASE (Required)
# ===========================================
DATABASE_URL=postgresql://mcrm_user:YOUR_PASSWORD@localhost:5432/mcrm_db

# ===========================================
# SESSION & SECURITY (Required)
# ===========================================
# Generate with: openssl rand -base64 64
SESSION_SECRET=your-64-character-random-secret-here
NODE_ENV=production
PORT=3000

# Cookie security (set to true when using HTTPS)
SECURE_COOKIES=true

# ===========================================
# AUTHENTICATION MODE
# ===========================================
# On VPS without Replit, leave these commented/unset
# The app will use local email/password authentication
# USE_REPLIT_AUTH=false  (auto-detected, no need to set)

# ===========================================
# OPENAI (Required for Knowledge Base search)
# ===========================================
OPENAI_API_KEY=sk-your-openai-api-key

# ===========================================
# EMAIL CONFIGURATION
# ===========================================
# Option 1: SMTP (Recommended for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="M-CRM <your-email@gmail.com>"
SMTP_SECURE=false

# Option 2: Resend (Fallback)
# RESEND_API_KEY=re_your_resend_api_key

# ===========================================
# OBJECT STORAGE (Optional - for file uploads)
# ===========================================
# If you're NOT using file uploads, skip this section

# Option 1: GCS with service account key (JSON string)
# GCS_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
# GCS_PROJECT_ID=your-project-id

# Option 2: GCS with key file path
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Required for object storage
# PUBLIC_OBJECT_SEARCH_PATHS=/bucket-name/public
# PRIVATE_OBJECT_DIR=/bucket-name/.private
```

### Secure the Environment File
```bash
chmod 600 /var/www/mcrm/.env
chown www-data:www-data /var/www/mcrm/.env
```

---

## 6. Setup PM2

### Use the Included Ecosystem File
```bash
cd /var/www/mcrm
pm2 start ecosystem.config.js --env production
```

### Save and Enable Startup
```bash
pm2 save
pm2 startup
# Follow the instructions shown
```

### PM2 Commands Reference
```bash
pm2 status              # Check status
pm2 logs mcrm           # View logs
pm2 restart mcrm        # Restart app
pm2 stop mcrm           # Stop app
pm2 delete mcrm         # Remove from PM2
```

---

## 7. Configure Nginx

### Create Site Configuration
```bash
nano /etc/nginx/sites-available/mcrm
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

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

    # File upload size limit (for attachments)
    client_max_body_size 50M;
}
```

### Enable Site
```bash
ln -s /etc/nginx/sites-available/mcrm /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Remove default site
nginx -t  # Test configuration
systemctl reload nginx
```

---

## 8. Setup SSL

### Install Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### Get Certificate
```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```

### Verify Auto-Renewal
```bash
certbot renew --dry-run
```

---

## 9. Verification

### Check Application Status
```bash
pm2 status
pm2 logs mcrm --lines 50
```

### Test the Application
1. Visit `https://your-domain.com`
2. Login with: `senthil@microgenn.com` / `Mgenn@123`
3. Test Knowledge Base search
4. Test email sending

### Firewall Configuration
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

---

## Troubleshooting

### Application Won't Start
```bash
# Check logs
pm2 logs mcrm --lines 100

# Check if port is in use
lsof -i :3000

# Verify environment variables
cat /var/www/mcrm/.env
```

### Database Connection Failed
```bash
# Test connection
psql -U mcrm_user -d mcrm_db -h localhost

# Check PostgreSQL status
systemctl status postgresql

# Check pg_hba.conf for local auth
sudo nano /etc/postgresql/16/main/pg_hba.conf
# Ensure this line exists:
# local   all   all   md5
```

### pgvector Not Working
```bash
sudo -u postgres psql -d mcrm_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Session/Cookie Issues
If login doesn't persist:
1. Check `SECURE_COOKIES` is set correctly
2. Ensure Nginx passes X-Forwarded-Proto header
3. Verify SSL is working

### Object Storage Issues
- Without GCS credentials, file upload features are disabled
- Check `GCS_SERVICE_ACCOUNT_KEY` format (must be valid JSON)

---

## Quick Reference

| Task | Command |
|------|---------|
| View app logs | `pm2 logs mcrm` |
| Restart app | `pm2 restart mcrm` |
| Rebuild app | `cd /var/www/mcrm && npm run build && pm2 restart mcrm` |
| Database console | `psql -U mcrm_user -d mcrm_db` |
| Backup database | `pg_dump -U mcrm_user mcrm_db > backup.sql` |
| Nginx logs | `tail -f /var/log/nginx/error.log` |
| SSL renew | `certbot renew` |

---

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| SESSION_SECRET | Yes | 64+ character random string |
| NODE_ENV | Yes | Set to `production` |
| PORT | No | Default: 3000 |
| SECURE_COOKIES | No | Default: true in production |
| OPENAI_API_KEY | Yes | For Knowledge Base search |
| SMTP_HOST | Recommended | Email server |
| SMTP_PORT | Recommended | Email port (587/465) |
| SMTP_USER | Recommended | Email username |
| SMTP_PASS | Recommended | Email password/app password |
| SMTP_FROM | Recommended | Sender address |
| GCS_SERVICE_ACCOUNT_KEY | Optional | For file uploads |
| GCS_PROJECT_ID | Optional | GCS project ID |

---

## Support

For issues, check:
1. PM2 logs: `pm2 logs mcrm`
2. Nginx logs: `/var/log/nginx/error.log`
3. PostgreSQL logs: `/var/log/postgresql/`
