#!/bin/bash

#######################################################################
# M-CRM VPS Deployment Script
# This script automates the deployment of M-CRM to an Ubuntu VPS
#######################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="mcrm"
APP_DIR="/var/www/mcrm"
LOG_DIR="/var/log/mcrm"
NODEJS_VERSION="20"
POSTGRES_VERSION="16"

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

# Get user input for configuration
get_configuration() {
    print_header "Configuration"
    
    read -p "Enter your domain name (e.g., crm.yourdomain.com): " DOMAIN
    read -p "Enter database password for mcrm_user: " -s DB_PASSWORD
    echo ""
    read -p "Enter your OpenAI API key: " OPENAI_KEY
    
    echo ""
    print_info "Email Configuration (press Enter to skip)"
    read -p "SMTP Host (e.g., smtp.gmail.com): " SMTP_HOST
    read -p "SMTP Port (e.g., 587): " SMTP_PORT
    read -p "SMTP User (email address): " SMTP_USER
    read -p "SMTP Password: " -s SMTP_PASS
    echo ""
    read -p "SMTP From (e.g., M-CRM <email@domain.com>): " SMTP_FROM
    
    # Generate session secret
    SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    
    print_success "Configuration collected"
}

# Step 1: System Update
update_system() {
    print_header "Step 1: Updating System"
    
    apt update && apt upgrade -y
    print_success "System updated"
}

# Step 2: Install Node.js
install_nodejs() {
    print_header "Step 2: Installing Node.js ${NODEJS_VERSION}"
    
    if command -v node &> /dev/null; then
        NODE_VER=$(node -v)
        print_warning "Node.js already installed: ${NODE_VER}"
    else
        curl -fsSL https://deb.nodesource.com/setup_${NODEJS_VERSION}.x | bash -
        apt install -y nodejs
        print_success "Node.js $(node -v) installed"
    fi
}

# Step 3: Install PostgreSQL with pgvector
install_postgresql() {
    print_header "Step 3: Installing PostgreSQL ${POSTGRES_VERSION} with pgvector"
    
    if command -v psql &> /dev/null; then
        print_warning "PostgreSQL already installed"
    else
        # Add PostgreSQL repository
        sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
        wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
        apt update
        
        # Install PostgreSQL and pgvector
        apt install -y postgresql-${POSTGRES_VERSION} postgresql-contrib-${POSTGRES_VERSION} postgresql-${POSTGRES_VERSION}-pgvector
        
        systemctl start postgresql
        systemctl enable postgresql
        
        print_success "PostgreSQL ${POSTGRES_VERSION} with pgvector installed"
    fi
}

# Step 4: Setup Database
setup_database() {
    print_header "Step 4: Setting Up Database"
    
    # Create user and database
    sudo -u postgres psql <<EOF
-- Create user if not exists
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'mcrm_user') THEN
      CREATE USER mcrm_user WITH PASSWORD '${DB_PASSWORD}';
   END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE mcrm_db OWNER mcrm_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mcrm_db')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE mcrm_db TO mcrm_user;

-- Connect and enable pgvector
\c mcrm_db
CREATE EXTENSION IF NOT EXISTS vector;
EOF

    print_success "Database configured"
    print_info "Database: mcrm_db"
    print_info "User: mcrm_user"
}

# Step 5: Install PM2 and Nginx
install_dependencies() {
    print_header "Step 5: Installing PM2 and Nginx"
    
    npm install -g pm2
    print_success "PM2 installed"
    
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
    print_success "Nginx installed"
}

# Step 6: Create Application Directory
setup_app_directory() {
    print_header "Step 6: Setting Up Application Directory"
    
    mkdir -p ${APP_DIR}
    mkdir -p ${LOG_DIR}
    
    print_success "Created ${APP_DIR}"
    print_success "Created ${LOG_DIR}"
    
    print_warning "Please upload your application files to ${APP_DIR}"
    print_info "You can use: scp -r /path/to/mcrm/* root@your-server:${APP_DIR}/"
    
    read -p "Press Enter when files are uploaded..." 
}

# Step 7: Install Dependencies and Build
build_application() {
    print_header "Step 7: Building Application"
    
    cd ${APP_DIR}
    
    if [ -f "package.json" ]; then
        npm install
        npm run build
        print_success "Application built successfully"
    else
        print_error "package.json not found. Please upload application files first."
        exit 1
    fi
}

# Step 8: Create Environment File
create_env_file() {
    print_header "Step 8: Creating Environment File"
    
    cat > ${APP_DIR}/.env <<EOF
# Database
DATABASE_URL=postgresql://mcrm_user:${DB_PASSWORD}@localhost:5432/mcrm_db

# Session
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=3000
SECURE_COOKIES=true

# OpenAI (for Knowledge Base)
OPENAI_API_KEY=${OPENAI_KEY}

# Email Configuration
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}
SMTP_SECURE=false
EOF

    chmod 600 ${APP_DIR}/.env
    print_success "Environment file created"
}

# Step 9: Configure Nginx
configure_nginx() {
    print_header "Step 9: Configuring Nginx"
    
    cat > /etc/nginx/sites-available/${APP_NAME} <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    client_max_body_size 50M;
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    nginx -t
    systemctl reload nginx
    
    print_success "Nginx configured for ${DOMAIN}"
}

# Step 10: Start Application with PM2
start_application() {
    print_header "Step 10: Starting Application with PM2"
    
    cd ${APP_DIR}
    
    pm2 start ecosystem.config.js --env production
    pm2 save
    pm2 startup
    
    print_success "Application started with PM2"
}

# Step 11: Setup SSL (Optional)
setup_ssl() {
    print_header "Step 11: Setting Up SSL (Let's Encrypt)"
    
    read -p "Do you want to setup SSL with Let's Encrypt? (y/n): " SETUP_SSL
    
    if [ "$SETUP_SSL" = "y" ] || [ "$SETUP_SSL" = "Y" ]; then
        apt install -y certbot python3-certbot-nginx
        certbot --nginx -d ${DOMAIN}
        print_success "SSL certificate installed"
    else
        print_warning "Skipping SSL setup"
        print_info "You can run 'certbot --nginx -d ${DOMAIN}' later"
    fi
}

# Step 12: Setup Firewall
setup_firewall() {
    print_header "Step 12: Configuring Firewall"
    
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    
    read -p "Enable firewall now? (y/n): " ENABLE_FW
    if [ "$ENABLE_FW" = "y" ] || [ "$ENABLE_FW" = "Y" ]; then
        ufw --force enable
        print_success "Firewall enabled"
    else
        print_warning "Firewall not enabled. Run 'ufw enable' when ready."
    fi
}

# Import Database
import_database() {
    print_header "Database Import"
    
    read -p "Do you have a database backup to import? (y/n): " IMPORT_DB
    
    if [ "$IMPORT_DB" = "y" ] || [ "$IMPORT_DB" = "Y" ]; then
        read -p "Enter path to backup file: " BACKUP_FILE
        
        if [ -f "$BACKUP_FILE" ]; then
            if [[ "$BACKUP_FILE" == *.dump ]]; then
                pg_restore -U mcrm_user -d mcrm_db -h localhost --no-owner --no-acl "$BACKUP_FILE"
            else
                psql -U mcrm_user -d mcrm_db -h localhost -f "$BACKUP_FILE"
            fi
            print_success "Database imported"
        else
            print_error "Backup file not found: $BACKUP_FILE"
        fi
    fi
}

# Print Summary
print_summary() {
    print_header "Deployment Complete!"
    
    echo -e "${GREEN}Your M-CRM application is now deployed!${NC}"
    echo ""
    echo "Summary:"
    echo "  - Application: ${APP_DIR}"
    echo "  - Domain: ${DOMAIN}"
    echo "  - Database: mcrm_db (user: mcrm_user)"
    echo "  - Port: 3000 (behind Nginx)"
    echo ""
    echo "Useful Commands:"
    echo "  pm2 status          - Check app status"
    echo "  pm2 logs mcrm       - View logs"
    echo "  pm2 restart mcrm    - Restart app"
    echo ""
    echo "Login Credentials:"
    echo "  Email: senthil@microgenn.com"
    echo "  Password: Mgenn@123"
    echo ""
    print_warning "Please change the default password after first login!"
}

# Main execution
main() {
    clear
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                           ║${NC}"
    echo -e "${BLUE}║    M-CRM VPS Deployment Script            ║${NC}"
    echo -e "${BLUE}║    Version 1.0                            ║${NC}"
    echo -e "${BLUE}║                                           ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
    echo ""
    
    check_root
    
    echo "This script will:"
    echo "  1. Update system packages"
    echo "  2. Install Node.js ${NODEJS_VERSION}"
    echo "  3. Install PostgreSQL ${POSTGRES_VERSION} with pgvector"
    echo "  4. Setup database (mcrm_db)"
    echo "  5. Install PM2 and Nginx"
    echo "  6. Configure your application"
    echo "  7. Setup SSL (optional)"
    echo ""
    
    read -p "Continue with deployment? (y/n): " CONTINUE
    
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        print_warning "Deployment cancelled"
        exit 0
    fi
    
    get_configuration
    update_system
    install_nodejs
    install_postgresql
    setup_database
    install_dependencies
    setup_app_directory
    build_application
    create_env_file
    configure_nginx
    import_database
    start_application
    setup_ssl
    setup_firewall
    print_summary
}

# Run main function
main "$@"
