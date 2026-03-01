#!/bin/bash
set -e

echo "🚀 TechFlow Deployment Script"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.production.example .env
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and set your production values:"
    echo "   - POSTGRES_PASSWORD"
    echo "   - JWT_SECRET (generate with: openssl rand -base64 32)"
    echo "   - GITHUB_CLIENT_ID"
    echo "   - GITHUB_CLIENT_SECRET"
    echo "   - FRONTEND_URL"
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "🔨 Building and starting services..."
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

echo ""
echo "📊 Service status:"
docker compose ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://localhost (or your domain)"
echo "   API: http://localhost:3001/health"
echo ""
echo "📝 Useful commands:"
echo "   View logs: docker compose logs -f"
echo "   Stop: docker compose down"
echo "   Restart: docker compose restart"
echo ""
