#!/bin/bash

# Twitch Live Assistant Deployment Script
echo "🚀 Deploying Twitch Live Assistant..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

# Check if package.json exists
if [ ! -f "twitch_package.json" ]; then
    echo "❌ twitch_package.json not found. Please run this script from the project directory."
    exit 1
fi

# Copy package.json
echo "📦 Setting up package.json..."
cp twitch_package.json package.json

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    if [ -f "twitch_env.example" ]; then
        cp twitch_env.example .env
        echo "📝 Please edit .env file with your actual credentials before running the application."
    else
        echo "❌ twitch_env.example not found. Please create .env file manually."
        exit 1
    fi
fi

# Check if required environment variables are set
echo "🔍 Checking environment configuration..."
source .env

if [ "$TWITCH_BOT_USERNAME" = "your_bot_username" ] || [ -z "$TWITCH_BOT_USERNAME" ]; then
    echo "❌ TWITCH_BOT_USERNAME not configured in .env file"
    exit 1
fi

if [ "$TWITCH_OAUTH_TOKEN" = "oauth:your_oauth_token_here" ] || [ -z "$TWITCH_OAUTH_TOKEN" ]; then
    echo "❌ TWITCH_OAUTH_TOKEN not configured in .env file"
    exit 1
fi

if [ "$TWITCH_CHANNEL" = "your_channel_name" ] || [ -z "$TWITCH_CHANNEL" ]; then
    echo "❌ TWITCH_CHANNEL not configured in .env file"
    exit 1
fi

if [ "$TWITCH_CLIENT_ID" = "your_client_id" ] || [ -z "$TWITCH_CLIENT_ID" ]; then
    echo "❌ TWITCH_CLIENT_ID not configured in .env file"
    exit 1
fi

if [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ] || [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  GEMINI_API_KEY not configured. AI features will be limited."
fi

echo "✅ Environment configuration looks good!"

# Create startup script
echo "📝 Creating startup script..."
cat > start_twitch.sh << 'EOF'
#!/bin/bash
echo "🎮 Starting Twitch Live Assistant..."
echo "📊 Dashboard will be available at: http://localhost:${PORT:-3000}/twitch_dashboard.html"
echo "🔗 API will be available at: http://localhost:${PORT:-3000}/api/metrics"
echo "Press Ctrl+C to stop the application"
node twitch_data_processor.js
EOF

chmod +x start_twitch.sh

# Create test script
echo "📝 Creating test script..."
cat > test_twitch.js << 'EOF'
const { WebSocket } = require('ws');

console.log('🧪 Testing Twitch Live Assistant...');

// Test WebSocket connection
const ws = new WebSocket('ws://localhost:3000');

ws.on('open', function() {
    console.log('✅ WebSocket connection successful');
    ws.close();
});

ws.on('error', function(error) {
    console.log('❌ WebSocket connection failed:', error.message);
    console.log('Make sure the Twitch Live Assistant is running on port 3000');
});

// Test API endpoints
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const health = JSON.parse(data);
            console.log('✅ API health check:', health.status);
            if (health.twitch.connected) {
                console.log('✅ Twitch connection: Connected');
            } else {
                console.log('⚠️  Twitch connection: Not connected');
            }
            if (health.gemini.isAvailable) {
                console.log('✅ Gemini AI: Available');
            } else {
                console.log('⚠️  Gemini AI: Not available (check API key)');
            }
        } catch (error) {
            console.log('❌ API health check failed:', error.message);
        }
    });
});

req.on('error', (error) => {
    console.log('❌ API test failed:', error.message);
    console.log('Make sure the Twitch Live Assistant is running on port 3000');
});

req.end();
EOF

echo "✅ Deployment completed successfully!"
echo ""
echo "🎯 Next steps:"
echo "1. Edit .env file with your actual Twitch credentials"
echo "2. Run: ./start_twitch.sh"
echo "3. Open: http://localhost:3000/twitch_dashboard.html"
echo "4. Test: node test_twitch.js"
echo ""
echo "📚 For more information, check the README file."
