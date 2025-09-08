#!/bin/bash

# Twitch Live Assistant Deployment Script for Render
echo "🚀 Deploying Twitch Live Assistant to Render..."

# Check if we're in the right directory
if [ ! -f "twitch_data_processor.js" ]; then
    echo "❌ Error: twitch_data_processor.js not found. Please run this script from the twitch-live-assistant directory."
    exit 1
fi

# Check if required files exist
required_files=("package.json" "Procfile" "render.yaml" "twitch_dashboard.html")
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Error: Required file $file not found."
        exit 1
    fi
done

echo "✅ All required files found."

# Check if .env file exists (optional)
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Make sure to set environment variables in Render dashboard."
    echo "   Copy env.example to .env and fill in your values."
fi

echo "📦 Files ready for deployment:"
echo "   - package.json (dependencies)"
echo "   - Procfile (start command)"
echo "   - render.yaml (Render configuration)"
echo "   - twitch_data_processor.js (main application)"
echo "   - twitch_dashboard.html (dashboard UI)"
echo "   - twitch_gemini_service.js (AI service)"
echo "   - twitch_gemini_config.js (AI configuration)"

echo ""
echo "🌐 Next steps:"
echo "1. Push this code to your GitHub repository"
echo "2. Connect your GitHub repo to Render"
echo "3. Set environment variables in Render dashboard:"
echo "   - TWITCH_CLIENT_ID"
echo "   - TWITCH_CLIENT_SECRET" 
echo "   - TWITCH_ACCESS_TOKEN"
echo "   - GEMINI_API_KEY (optional)"
echo "4. Deploy!"

echo ""
echo "✅ Deployment preparation complete!"
