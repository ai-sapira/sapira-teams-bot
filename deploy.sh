#!/bin/bash

# 🚀 Deploy Script for Sapira Teams Bot
# This script commits and deploys the updated bot to production

set -e  # Exit on error

echo "🚀 Starting Sapira Teams Bot Deployment..."
echo ""

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: Must run from sapira-teams-bot directory"
    exit 1
fi

# Show current git status
echo "📊 Current Git Status:"
git status --short
echo ""

# Ask for confirmation
read -p "🤔 Do you want to commit and deploy these changes? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

# Add modified files
echo "📝 Adding modified files..."
git add server.js lib/conversation-manager.js DEPLOYMENT.md COMMIT_MESSAGE.txt deploy.sh

# Commit with the prepared message
echo "💾 Committing changes..."
git commit -F COMMIT_MESSAGE.txt

# Push to repository
echo "📤 Pushing to repository..."
git push origin main

echo ""
echo "✅ Changes pushed successfully!"
echo ""
echo "📡 Your hosting service should auto-deploy now."
echo "   Check your dashboard for deployment status:"
echo ""
echo "   - Render: https://dashboard.render.com"
echo "   - Heroku: https://dashboard.heroku.com"
echo "   - Azure: https://portal.azure.com"
echo ""
echo "🧪 After deployment, test with:"
echo "   curl https://your-bot-domain.com/health"
echo ""
echo "📚 See DEPLOYMENT.md for full testing instructions"
echo ""
echo "🎉 Deployment process complete!"
