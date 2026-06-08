#!/bin/bash
# ============================================================
# WACRM Full Stack Deployment Script for 1Panel Server
# Run this on your server (74.113.234.8) via SSH
# ============================================================
set -e

APP_DIR="/opt/wacrm"

echo "=============================================="
echo "  WACRM Full Stack Deployment"
echo "=============================================="

# Preflight checks
command -v docker &>/dev/null || { echo "❌ Docker not found. Install with: curl -fsSL https://get.docker.com | sh"; exit 1; }
docker compose version &>/dev/null || { echo "❌ Docker Compose not found."; exit 1; }
echo "✅ Docker & Compose available"

# Create project directory
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# If repo already cloned, just pull latest
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes..."
    git pull
else
    echo "📥 Clone your repo into $APP_DIR first:"
    echo "   git clone <your-repo-url> $APP_DIR"
    exit 1
fi

# Create .env.local if missing
if [ ! -f ".env.local" ]; then
cat > .env.local << 'ENVEOF'
NODE_ENV=production
AUTOMATION_CRON_SECRET=your_automation_cron_secret
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ENCRYPTION_KEY=your_whatsapp_token_encryption_key
META_APP_SECRET=your_meta_app_secret
NEXT_PUBLIC_SITE_URL=https://your-domain.com
ENVEOF
    echo "✅ .env.local created with placeholders. Please edit it with your real credentials!"
else
    echo "✅ .env.local already exists"
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.production.yml down 2>/dev/null || true

# Build and start all services
echo "🐳 Building and starting all services..."
docker compose -f docker-compose.production.yml up -d --build

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 15

# Health check
echo ""
echo "=============================================="
echo "  Container Status"
echo "=============================================="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep wacrm

echo ""
echo "=============================================="
echo "  Deployment Complete!"
echo "=============================================="
echo ""
echo "  Services:"
echo "  ├── WACRM App        → https://wacrm.1netsoft.com (port 3000)"
echo "  ├── Evolution API    → https://evolution.1netsoft.com (port 8080)"
echo "  ├── PostgreSQL       → localhost:54322"
echo "  └── Redis            → localhost:63799"
echo ""
echo "  DNS Required (A records → 74.113.234.8):"
echo "  ├── wacrm.1netsoft.com"
echo "  └── evolution.1netsoft.com"
echo ""
