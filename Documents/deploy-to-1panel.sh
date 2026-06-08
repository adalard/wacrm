#!/bin/bash
# ============================================================
# WACRM 1Panel Deployment Script
# Run this script on your 1Panel server via SSH
# ============================================================

set -e

# Configuration
DOMAIN="wacrm.1net.my"
APP_DIR="/opt/wacrm"
REPO_URL="https://github.com/YOUR_USERNAME/wacrm.git"  # Update this!

echo "=============================================="
echo "WACRM 1Panel Deployment Script"
echo "=============================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Run: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Create app directory
echo "📁 Creating application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or update repository
if [ -d ".git" ]; then
    echo "📥 Updating existing repository..."
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone $REPO_URL .
fi

# Check for .env.local
if [ ! -f ".env.local" ]; then
    echo ""
    echo "⚠️  No .env.local found. Creating from template..."
    cp .env.local.example .env.local
    echo ""
    echo "🔧 IMPORTANT: Edit .env.local with your credentials:"
    echo "   nano $APP_DIR/.env.local"
    echo ""
    echo "Required variables:"
    echo "  - NEXT_PUBLIC_SUPABASE_URL"
    echo "  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    echo "  - SUPABASE_SECRET_KEY"
    echo "  - ENCRYPTION_KEY (generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")"
    echo "  - META_APP_SECRET"
    echo "  - NEXT_PUBLIC_SITE_URL=https://$DOMAIN"
    echo ""
    read -p "Press Enter after editing .env.local to continue..."
fi

# Build and start containers
echo "🐳 Building and starting Docker containers..."
docker compose down 2>/dev/null || true
docker compose up -d --build

# Wait for container to be healthy
echo "⏳ Waiting for container to start..."
sleep 10

# Check container status
if docker ps | grep -q "wacrm-app"; then
    echo "✅ WACRM container is running!"
    echo ""
    echo "=============================================="
    echo "Deployment Complete!"
    echo "=============================================="
    echo ""
    echo "📌 Next Steps:"
    echo "1. Configure OpenResty in 1Panel (if not done):"
    echo "   - Go to Website → Create Website"
    echo "   - Type: Reverse Proxy"
    echo "   - Domain: $DOMAIN"
    echo "   - Proxy Address: 127.0.0.1:3000"
    echo ""
    echo "2. Configure SSL in 1Panel:"
    echo "   - Go to Website → $DOMAIN → SSL"
    echo "   - Enable Let's Encrypt"
    echo ""
    echo "3. Configure DNS:"
    echo "   - Add A record: $DOMAIN → $(curl -s ifconfig.me)"
    echo ""
    echo "4. Access your app:"
    echo "   - Internal: http://localhost:3000"
    echo "   - Public: https://$DOMAIN (after DNS + SSL)"
    echo ""
else
    echo "❌ Container failed to start. Check logs:"
    echo "   docker logs wacrm-app"
    exit 1
fi
