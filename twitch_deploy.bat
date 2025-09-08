@echo off
REM Twitch Live Assistant Deployment Script for Windows
echo 🚀 Deploying Twitch Live Assistant...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_VERSION=%%a
set NODE_VERSION=%NODE_VERSION:v=%
if %NODE_VERSION% lss 18 (
    echo ❌ Node.js version 18+ is required. Current version: 
    node -v
    pause
    exit /b 1
)

REM Check if package.json exists
if not exist "twitch_package.json" (
    echo ❌ twitch_package.json not found. Please run this script from the project directory.
    pause
    exit /b 1
)

REM Copy package.json
echo 📦 Setting up package.json...
copy twitch_package.json package.json >nul

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  .env file not found. Creating from template...
    if exist "twitch_env.example" (
        copy twitch_env.example .env >nul
        echo 📝 Please edit .env file with your actual credentials before running the application.
    ) else (
        echo ❌ twitch_env.example not found. Please create .env file manually.
        pause
        exit /b 1
    )
)

REM Create startup script
echo 📝 Creating startup script...
(
echo @echo off
echo echo 🎮 Starting Twitch Live Assistant...
echo echo 📊 Dashboard will be available at: http://localhost:${PORT:-3000}/twitch_dashboard.html
echo echo 🔗 API will be available at: http://localhost:${PORT:-3000}/api/metrics
echo echo Press Ctrl+C to stop the application
echo node twitch_data_processor.js
) > start_twitch.bat

REM Create test script
echo 📝 Creating test script...
(
echo const { WebSocket } = require('ws'^);
echo.
echo console.log('🧪 Testing Twitch Live Assistant...'^);
echo.
echo // Test WebSocket connection
echo const ws = new WebSocket('ws://localhost:3000'^);
echo.
echo ws.on('open', function(^) {
echo     console.log('✅ WebSocket connection successful'^);
echo     ws.close(^);
echo }^);
echo.
echo ws.on('error', function(error^) {
echo     console.log('❌ WebSocket connection failed:', error.message^);
echo     console.log('Make sure the Twitch Live Assistant is running on port 3000'^);
echo }^);
echo.
echo // Test API endpoints
echo const http = require('http'^);
echo.
echo const options = {
echo     hostname: 'localhost',
echo     port: 3000,
echo     path: '/api/health',
echo     method: 'GET'
echo };
echo.
echo const req = http.request(options, (res^) =^> {
echo     let data = '';
echo     
echo     res.on('data', (chunk^) =^> {
echo         data += chunk;
echo     }^);
echo     
echo     res.on('end', (^) =^> {
echo         try {
echo             const health = JSON.parse(data^);
echo             console.log('✅ API health check:', health.status^);
echo             if (health.twitch.connected^) {
echo                 console.log('✅ Twitch connection: Connected'^);
echo             } else {
echo                 console.log('⚠️  Twitch connection: Not connected'^);
echo             }
echo             if (health.gemini.isAvailable^) {
echo                 console.log('✅ Gemini AI: Available'^);
echo             } else {
echo                 console.log('⚠️  Gemini AI: Not available (check API key^)'^);
echo             }
echo         } catch (error^) {
echo             console.log('❌ API health check failed:', error.message^);
echo         }
echo     }^);
echo }^);
echo.
echo req.on('error', (error^) =^> {
echo     console.log('❌ API test failed:', error.message^);
echo     console.log('Make sure the Twitch Live Assistant is running on port 3000'^);
echo }^);
echo.
echo req.end(^);
) > test_twitch.js

echo ✅ Deployment completed successfully!
echo.
echo 🎯 Next steps:
echo 1. Edit .env file with your actual Twitch credentials
echo 2. Run: start_twitch.bat
echo 3. Open: http://localhost:3000/twitch_dashboard.html
echo 4. Test: node test_twitch.js
echo.
echo 📚 For more information, check the README file.
pause
