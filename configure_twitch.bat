@echo off
echo 🎮 Twitch Live Assistant Configuration Helper
echo ============================================
echo.

echo Please provide the following information from your Twitch Token Generator:
echo.

set /p BOT_USERNAME="Enter your bot's Twitch username: "
set /p ACCESS_TOKEN="Enter your access token (without oauth:): "
set /p CHANNEL_NAME="Enter the channel to monitor (without #): "
set /p CLIENT_ID="Enter your Client ID: "
set /p CLIENT_SECRET="Enter your Client Secret: "
set /p GEMINI_KEY="Enter your Gemini API key (optional, press Enter to skip): "

echo.
echo 📝 Updating .env file...

echo # Twitch Live Assistant Environment Configuration > .env
echo # Generated on %date% %time% >> .env
echo. >> .env
echo # Twitch Bot Configuration >> .env
echo TWITCH_BOT_USERNAME=%BOT_USERNAME% >> .env
echo TWITCH_OAUTH_TOKEN=oauth:%ACCESS_TOKEN% >> .env
echo TWITCH_CHANNEL=%CHANNEL_NAME% >> .env
echo. >> .env
echo # Twitch API Configuration >> .env
echo TWITCH_CLIENT_ID=%CLIENT_ID% >> .env
echo TWITCH_CLIENT_SECRET=%CLIENT_SECRET% >> .env
echo TWITCH_ACCESS_TOKEN=%ACCESS_TOKEN% >> .env
echo. >> .env
echo # Gemini AI Configuration >> .env
echo GEMINI_API_KEY=%GEMINI_KEY% >> .env
echo. >> .env
echo # Server Configuration >> .env
echo PORT=3000 >> .env
echo NODE_ENV=development >> .env

echo.
echo ✅ Configuration complete!
echo.
echo 🚀 To start the Twitch assistant, run:
echo    npm start
echo.
echo 📊 Dashboard will be available at:
echo    http://localhost:3000/twitch_dashboard.html
echo.
pause
