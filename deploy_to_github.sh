#!/bin/bash

echo "🚀 Deploying Twitch Live Assistant to GitHub"
echo "================================================"

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not initialized. Initializing..."
    git init
    echo "✅ Git repository initialized"
fi

# Check if we're in the right directory
if [ ! -f "twitch_data_processor.js" ]; then
    echo "❌ Please run this script from the twitch-live-assistant directory"
    exit 1
fi

echo "📋 Pre-deployment checklist:"
echo

# Check for required files
if [ -f "package.json" ]; then
    echo "✅ package.json found"
else
    echo "❌ package.json not found"
    exit 1
fi

if [ -f "twitch_data_processor.js" ]; then
    echo "✅ Main server file found"
else
    echo "❌ Main server file not found"
    exit 1
fi

if [ -f "twitch_dashboard.html" ]; then
    echo "✅ Dashboard file found"
else
    echo "❌ Dashboard file not found"
    exit 1
fi

echo
echo "🔧 Setting up Git configuration..."

# Set up git user if not already set
if ! git config user.name >/dev/null 2>&1; then
    read -p "Enter your GitHub username: " username
    git config user.name "$username"
fi

if ! git config user.email >/dev/null 2>&1; then
    read -p "Enter your GitHub email: " email
    git config user.email "$email"
fi

echo
echo "📦 Adding files to Git..."

# Add all files
git add .

# Check if there are changes to commit
if ! git diff --cached --quiet; then
    echo "📝 Committing changes..."
    git commit -m "Deploy: Twitch Live Assistant with fixes and improvements

- Fixed NewsAPI 404 errors with correct country codes
- Fixed language switcher with proper sessionId handling
- Fixed ABT timer container display issues
- Fixed AI prompt translation showing raw keys
- Added comprehensive test files
- Enhanced error handling and logging
- Added multi-language support for prompts"
    echo "✅ Changes committed"
else
    echo "ℹ️ No changes to commit"
fi

echo
echo "🌐 GitHub Repository Setup:"
echo
echo "1. Go to https://github.com/new"
echo "2. Create a new repository named 'twitch-live-assistant'"
echo "3. Make it PUBLIC (required for free Render deployment)"
echo "4. DO NOT initialize with README, .gitignore, or license"
echo "5. Click 'Create repository'"
echo
echo "After creating the repository, run these commands:"
echo
echo "git remote add origin https://github.com/YOUR_USERNAME/twitch-live-assistant.git"
echo "git branch -M main"
echo "git push -u origin main"
echo

read -p "Have you created the GitHub repository? (y/n): " continue

if [[ $continue =~ ^[Yy]$ ]]; then
    echo
    read -p "Enter your GitHub repository URL (e.g., https://github.com/username/twitch-live-assistant.git): " repo_url
    
    echo "🔗 Adding remote origin..."
    if ! git remote add origin "$repo_url" 2>/dev/null; then
        echo "⚠️ Remote already exists, updating..."
        git remote set-url origin "$repo_url"
    fi
    
    echo "📤 Pushing to GitHub..."
    git branch -M main
    git push -u origin main
    
    if [ $? -ne 0 ]; then
        echo "❌ Push failed. Please check your repository URL and try again."
        exit 1
    fi
    
    echo
    echo "✅ Successfully deployed to GitHub!"
    echo
    echo "🚀 Next Steps:"
    echo "1. Go to https://dashboard.render.com"
    echo "2. Create a new Web Service"
    echo "3. Connect your GitHub repository"
    echo "4. Use the configuration from render.yaml"
    echo "5. Set up your environment variables"
    echo
    echo "📖 For detailed instructions, see: GITHUB_DEPLOYMENT_GUIDE.md"
    echo
else
    echo
    echo "📖 Please create the GitHub repository first, then run this script again."
    echo "See GITHUB_DEPLOYMENT_GUIDE.md for detailed instructions."
fi

echo
echo "🎉 Deployment script completed!"
