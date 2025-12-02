#!/bin/bash

#######################################################################
# M-CRM Database Export Script
# Run this on Replit to export your database for VPS migration
#######################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   M-CRM Database Export                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}DATABASE_URL not found in environment${NC}"
    read -p "Enter your DATABASE_URL: " DATABASE_URL
fi

# Create backup directory
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Export options
echo "Select export format:"
echo "  1) Custom format (.dump) - Recommended for large databases"
echo "  2) SQL format (.sql) - Human readable"
read -p "Enter choice (1 or 2): " FORMAT_CHOICE

if [ "$FORMAT_CHOICE" = "1" ]; then
    BACKUP_FILE="${BACKUP_DIR}/mcrm_backup_${TIMESTAMP}.dump"
    echo ""
    echo -e "${BLUE}Exporting database to ${BACKUP_FILE}...${NC}"
    
    pg_dump "$DATABASE_URL" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        -F c \
        -f "$BACKUP_FILE"
else
    BACKUP_FILE="${BACKUP_DIR}/mcrm_backup_${TIMESTAMP}.sql"
    echo ""
    echo -e "${BLUE}Exporting database to ${BACKUP_FILE}...${NC}"
    
    pg_dump "$DATABASE_URL" \
        --no-owner \
        --no-acl \
        > "$BACKUP_FILE"
fi

# Get file size
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo ""
echo -e "${GREEN}✓ Database exported successfully!${NC}"
echo ""
echo "Backup file: $BACKUP_FILE"
echo "File size: $FILE_SIZE"
echo ""
echo "Next steps:"
echo "  1. Download this file from Replit"
echo "  2. Upload to your VPS: scp $BACKUP_FILE root@your-vps:/root/"
echo "  3. Import on VPS with the deployment script"
echo ""
