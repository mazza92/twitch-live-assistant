@echo off
REM Twitch Live Assistant Deployment Script for Render (Windows)

echo 🚀 Deploying Twitch Live Assistant to Render...

REM Check if we're in the right directory
if not exist "twitch_data_processor.js" (
    echo ❌ Error: twitch_data_processor.js not found. Please run this script from the twitch-live-assistant directory.
    pause
    exit /b 1
)

REM Check if required files exist
set required_files=package.json Procfile render.yaml twitch_dashboard.html
for %%f in (%required_files%) do (
    if not exist "%%f" (
        echo ❌ Error: Required file %%f not found.
        pause
        exit /b 1
    )
)

echo ✅ All required files found.

REM Check if .env file exists (optional)
if not exist ".env" (
    echo ⚠️  Warning: .env file not found. Make sure to set environment variables in Render dashboard.
    echo    Copy env.example to .env and fill in your values.
)

echo 📦 Files ready for deployment:
echo    - package.json (dependencies)
echo    - Procfile (start command)
echo    - render.yaml (Render configuration)
echo    - twitch_data_processor.js (main application)
echo    - twitch_dashboard.html (dashboard UI)
echo    - twitch_gemini_service.js (AI service)
echo    - twitch_gemini_config.js (AI configuration)

echo.
echo 🌐 Next steps:
echo 1. Push this code to your GitHub repository
echo 2. Connect your GitHub repo to Render
echo 3. Set environment variables in Render dashboard:
echo    - TWITCH_CLIENT_ID
echo    - TWITCH_CLIENT_SECRET
echo    - TWITCH_ACCESS_TOKEN
echo    - GEMINI_API_KEY (optional)
echo 4. Deploy!

echo.
echo ✅ Deployment preparation complete!
pause
