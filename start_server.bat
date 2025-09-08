@echo off
echo Starting Twitch Live Assistant Server...
echo.
echo Make sure you have:
echo 1. .env file configured with Twitch credentials
echo 2. Bot is a moderator in the channel
echo.
echo Starting server on http://localhost:3000
echo Dashboard will be available at: http://localhost:3000
echo.
node twitch_data_processor.js
pause
