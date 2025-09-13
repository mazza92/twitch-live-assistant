@echo off
echo 🚀 Deploying Twitch Live Assistant to GitHub
echo ================================================

REM Check if git is initialized
if not exist ".git" (
    echo ❌ Git repository not initialized. Initializing...
    git init
    echo ✅ Git repository initialized
)

REM Check if we're in the right directory
if not exist "twitch_data_processor.js" (
    echo ❌ Please run this script from the twitch-live-assistant directory
    pause
    exit /b 1
)

echo 📋 Pre-deployment checklist:
echo.

REM Check for required files
if exist "package.json" (
    echo ✅ package.json found
) else (
    echo ❌ package.json not found
    pause
    exit /b 1
)

if exist "twitch_data_processor.js" (
    echo ✅ Main server file found
) else (
    echo ❌ Main server file not found
    pause
    exit /b 1
)

if exist "twitch_dashboard.html" (
    echo ✅ Dashboard file found
) else (
    echo ❌ Dashboard file not found
    pause
    exit /b 1
)

echo.
echo 🔧 Setting up Git configuration...

REM Set up git user if not already set
git config user.name >nul 2>&1
if errorlevel 1 (
    set /p username="Enter your GitHub username: "
    git config user.name "%username%"
)

git config user.email >nul 2>&1
if errorlevel 1 (
    set /p email="Enter your GitHub email: "
    git config user.email "%email%"
)

echo.
echo 📦 Adding files to Git...

REM Add all files
git add .

REM Check if there are changes to commit
git diff --cached --quiet
if errorlevel 1 (
    echo 📝 Committing changes...
    git commit -m "Deploy: Twitch Live Assistant with fixes and improvements

- Fixed NewsAPI 404 errors with correct country codes
- Fixed language switcher with proper sessionId handling
- Fixed ABT timer container display issues
- Fixed AI prompt translation showing raw keys
- Added comprehensive test files
- Enhanced error handling and logging
- Added multi-language support for prompts"
    echo ✅ Changes committed
) else (
    echo ℹ️ No changes to commit
)

echo.
echo 🌐 GitHub Repository Setup:
echo.
echo 1. Go to https://github.com/new
echo 2. Create a new repository named 'twitch-live-assistant'
echo 3. Make it PUBLIC (required for free Render deployment)
echo 4. DO NOT initialize with README, .gitignore, or license
echo 5. Click 'Create repository'
echo.
echo After creating the repository, run these commands:
echo.
echo git remote add origin https://github.com/YOUR_USERNAME/twitch-live-assistant.git
echo git branch -M main
echo git push -u origin main
echo.

set /p continue="Have you created the GitHub repository? (y/n): "
if /i "%continue%"=="y" (
    echo.
    set /p repo_url="Enter your GitHub repository URL (e.g., https://github.com/username/twitch-live-assistant.git): "
    
    echo 🔗 Adding remote origin...
    git remote add origin "%repo_url%" 2>nul
    if errorlevel 1 (
        echo ⚠️ Remote already exists, updating...
        git remote set-url origin "%repo_url%"
    )
    
    echo 📤 Pushing to GitHub...
    git branch -M main
    git push -u origin main
    
    if errorlevel 1 (
        echo ❌ Push failed. Please check your repository URL and try again.
        pause
        exit /b 1
    )
    
    echo.
    echo ✅ Successfully deployed to GitHub!
    echo.
    echo 🚀 Next Steps:
    echo 1. Go to https://dashboard.render.com
    echo 2. Create a new Web Service
    echo 3. Connect your GitHub repository
    echo 4. Use the configuration from render.yaml
    echo 5. Set up your environment variables
    echo.
    echo 📖 For detailed instructions, see: GITHUB_DEPLOYMENT_GUIDE.md
    echo.
) else (
    echo.
    echo 📖 Please create the GitHub repository first, then run this script again.
    echo See GITHUB_DEPLOYMENT_GUIDE.md for detailed instructions.
)

echo.
echo 🎉 Deployment script completed!
pause
