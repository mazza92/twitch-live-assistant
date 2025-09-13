# 🚀 Quick Start: Deploy to GitHub

## **One-Click Deployment**

### **Windows Users**
```bash
# Run the deployment script
deploy_to_github.bat
```

### **Linux/Mac Users**
```bash
# Make script executable and run
chmod +x deploy_to_github.sh
./deploy_to_github.sh
```

## **What the Script Does**

1. ✅ **Checks** all required files are present
2. ✅ **Initializes** Git repository if needed
3. ✅ **Configures** Git user settings
4. ✅ **Commits** all changes with descriptive message
5. ✅ **Guides** you through GitHub repository creation
6. ✅ **Pushes** code to GitHub automatically

## **After Running the Script**

### **1. Create GitHub Repository**
- Go to https://github.com/new
- Name: `twitch-live-assistant`
- Make it **PUBLIC** (required for free Render)
- **Don't** initialize with README, .gitignore, or license

### **2. Deploy to Render**
- Go to https://dashboard.render.com
- Create new Web Service
- Connect your GitHub repository
- Use the `render.yaml` configuration
- Set up environment variables

### **3. Get Twitch API Keys**
- Go to https://dev.twitch.tv/console/apps
- Create new application
- Get Client ID and Secret
- Generate access token at https://twitchtokengenerator.com/

## **Environment Variables Needed**

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | `production` | ✅ |
| `PORT` | `10000` | ✅ |
| `TWITCH_CLIENT_ID` | Your Twitch app ID | ✅ |
| `TWITCH_CLIENT_SECRET` | Your Twitch app secret | ✅ |
| `TWITCH_ACCESS_TOKEN` | Your Twitch access token | ✅ |
| `GEMINI_API_KEY` | For AI features (optional) | ❌ |

## **Test Your Deployment**

1. **Health Check**: `https://your-app.onrender.com/api/health`
2. **Dashboard**: `https://your-app.onrender.com/twitch_dashboard.html`
3. **Connect Channel**: Enter a Twitch channel name and click Connect

## **Troubleshooting**

- **Build fails**: Check `package.json` dependencies
- **App crashes**: Verify environment variables
- **Can't connect**: Check Twitch API credentials
- **Dashboard errors**: Check browser console

## **Need Help?**

- 📖 **Full Guide**: `GITHUB_DEPLOYMENT_GUIDE.md`
- ✅ **Checklist**: `DEPLOYMENT_CHECKLIST.md`
- 🧪 **Test Files**: `test_*.html` files for testing

---

**🎉 That's it! Your Twitch Live Assistant will be live in minutes!**
