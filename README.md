# 🎮 Twitch Live Assistant

A real-time analytics and engagement assistant for Twitch streamers, featuring AI-powered insights, revenue tracking, and comprehensive stream metrics.

## ✨ Features

### 📊 Real-time Analytics
- **Live Viewer Tracking**: Current viewers, peak viewers, viewer trends
- **Chat Analytics**: Message rates, sentiment analysis, engagement metrics
- **Revenue Tracking**: Bits, subscriptions (Tier 1/2/3), accurate monetization
- **Follower Growth**: New followers, growth rates, engagement tracking

### 🤖 AI-Powered Insights
- **Smart Prompts**: Context-aware engagement suggestions
- **Sentiment Analysis**: Real-time chat mood monitoring
- **Growth Recommendations**: AI-driven stream optimization tips
- **Engagement Scoring**: Live chat activity scoring system

### 💰 Revenue Analytics
- **Accurate Conversions**: Real Twitch monetization rates
- **Tier Breakdown**: Detailed subscription tier tracking
- **Session Revenue**: Real-time earnings during stream
- **Revenue Projections**: Hourly rate calculations

### 🎯 Stream Management
- **Multi-Channel Support**: Connect to any Twitch channel
- **Real-time Updates**: Live data synchronization
- **Session Tracking**: Complete stream session analytics
- **Export Ready**: Data ready for external analysis

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd twitch-live-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your Twitch API credentials
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Open the dashboard**
   ```
   http://localhost:3000/twitch_dashboard.html
   ```

### Production Deployment (Render)

1. **Prepare for deployment**
   ```bash
   # Windows
   deploy.bat
   
   # Linux/Mac
   chmod +x deploy.sh
   ./deploy.sh
   ```

2. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy Twitch Live Assistant"
   git push origin main
   ```

3. **Deploy on Render**
   - Connect your GitHub repository to Render
   - Create a new Web Service
   - Set environment variables in Render dashboard
   - Deploy!

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TWITCH_CLIENT_ID` | Twitch API Client ID | ✅ |
| `TWITCH_CLIENT_SECRET` | Twitch API Client Secret | ✅ |
| `TWITCH_ACCESS_TOKEN` | Twitch API Access Token | ✅ |
| `GEMINI_API_KEY` | Google Gemini AI API Key | ❌ (Optional) |

### Twitch API Setup

1. **Create a Twitch Application**
   - Go to [Twitch Developer Console](https://dev.twitch.tv/console/apps)
   - Create a new application
   - Note your Client ID and Client Secret

2. **Generate Access Token**
   - Use Twitch's OAuth flow
   - Required scopes: `chat:read`, `channel:read:subscriptions`

3. **Configure Bot (Optional)**
   - Create a Twitch bot account
   - Generate OAuth token for the bot
   - Add bot credentials to environment variables

## 📱 Usage

### Dashboard Features

1. **Channel Connection**
   - Enter any Twitch channel name
   - Click "Connect" to start monitoring
   - Real-time metrics will appear

2. **Metrics Overview**
   - **Stream Status**: Live/offline indicator
   - **Viewer Count**: Current and peak viewers
   - **Revenue**: Total earnings and hourly rate
   - **Engagement**: Chat activity and sentiment

3. **Revenue Breakdown**
   - Bits revenue (1 bit = $0.01)
   - Subscription tiers (Tier 1: $2.50, Tier 2: $5.00, Tier 3: $12.50)
   - Session earnings
   - Projected hourly rate

4. **AI Insights**
   - Smart engagement prompts
   - Sentiment analysis
   - Growth recommendations
   - Context-aware suggestions

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/metrics` | GET | Get current stream metrics |
| `/api/health` | GET | Health check endpoint |
| `/api/connect-channel` | POST | Connect to a Twitch channel |
| `/api/disconnect-channel` | POST | Disconnect from current channel |
| `/api/test-events` | POST | Simulate test events |

## 🏗️ Architecture

### Backend Components
- **Express.js Server**: REST API and WebSocket server
- **TMI.js Client**: Twitch IRC connection and event handling
- **Twitch Helix API**: Stream information and user data
- **Google Gemini AI**: AI-powered insights and prompts
- **Sentiment Analysis**: Real-time chat mood analysis

### Frontend Components
- **Real-time Dashboard**: Live metrics display
- **WebSocket Client**: Real-time data updates
- **Revenue Calculator**: Accurate monetization tracking
- **Multi-language Support**: English, French, Spanish, German

### Data Flow
1. **Twitch IRC** → Real-time chat events
2. **Twitch API** → Stream information
3. **Processing** → Metrics calculation and analysis
4. **WebSocket** → Real-time dashboard updates
5. **AI Service** → Smart insights and recommendations

## 🔒 Security

- Environment variables for sensitive data
- No hardcoded credentials
- Secure WebSocket connections
- Input validation and sanitization

## 📈 Performance

- **Real-time Updates**: 2-second refresh rate
- **Efficient Processing**: Optimized event handling
- **Scalable Architecture**: Ready for multiple channels
- **Memory Management**: Automatic cleanup of old data

## 🛠️ Development

### Project Structure
```
twitch-live-assistant/
├── twitch_data_processor.js    # Main server application
├── twitch_dashboard.html       # Dashboard UI
├── twitch_gemini_service.js    # AI service
├── twitch_gemini_config.js     # AI configuration
├── package.json                # Dependencies
├── Procfile                    # Render deployment
├── render.yaml                 # Render configuration
├── deploy.sh                   # Deployment script
└── README.md                   # This file
```

### Adding Features
1. **Backend**: Modify `twitch_data_processor.js`
2. **Frontend**: Update `twitch_dashboard.html`
3. **AI**: Extend `twitch_gemini_service.js`
4. **Testing**: Use `/api/test-events` endpoint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: GitHub Issues
- **Documentation**: This README
- **API Reference**: Twitch API Documentation
- **Community**: Twitch Developer Community

## 🎯 Roadmap

- [ ] Multi-streamer dashboard
- [ ] Advanced AI insights
- [ ] Mobile app
- [ ] Integration with other platforms
- [ ] Advanced analytics and reporting
- [ ] Custom alert system
- [ ] Stream optimization recommendations

---

**Made with ❤️ for the Twitch streaming community**
