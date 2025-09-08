// Test Twitch metrics and API integration
require('dotenv').config();

// Simulate the Twitch data processor setup
const streamMetrics = {
    // Basic stream info
    streamStartTime: null,
    currentViewerCount: 0,
    peakViewerCount: 0,
    averageViewerCount: 0,
    totalViewerMinutes: 0,
    
    // Chat metrics
    totalMessages: 0,
    messagesPerMinute: 0,
    recentMessages: [],
    uniqueChatters: new Set(),
    
    // Follow metrics
    totalFollowers: 0,
    sessionFollowersGained: 0,
    followersGainsPerMinute: 0,
    newFollowers: [],
    
    // Subscription metrics
    totalSubs: 0,
    sessionSubsGained: 0,
    subsGainsPerMinute: 0,
    newSubs: [],
    
    // Bits metrics
    totalBits: 0,
    sessionBitsEarned: 0,
    bitsPerMinute: 0,
    recentBits: [],
    
    // Raid metrics
    totalRaids: 0,
    sessionRaidsReceived: 0,
    recentRaids: [],
    
    // Engagement metrics
    averageWatchTime: 0,
    viewerRetention: 0,
    rollingSentimentScore: 0,
    
    // User engagement tracking
    topEngagedUsers: [],
    userEngagement: new Map(),
    
    // AI prompt history
    promptHistory: [],
    lastPromptTime: 0,
    
    // Stream health
    isLive: false,
    streamTitle: '',
    gameCategory: '',
    streamLanguage: 'en'
};

// Twitch API configuration
const TWITCH_API_CONFIG = {
    clientId: process.env.TWITCH_CLIENT_ID || 'your_client_id',
    clientSecret: process.env.TWITCH_CLIENT_SECRET || 'your_client_secret',
    accessToken: process.env.TWITCH_ACCESS_TOKEN || 'your_access_token'
};

// Twitch API helper functions
async function getTwitchAPI(endpoint, params = {}) {
    const url = new URL(`https://api.twitch.tv/helix/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    const response = await fetch(url, {
        headers: {
            'Client-ID': TWITCH_API_CONFIG.clientId,
            'Authorization': `Bearer ${TWITCH_API_CONFIG.accessToken}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Twitch API error: ${response.status}`);
    }
    
    return response.json();
}

// Get current stream info
async function getStreamInfo() {
    try {
        console.log(`🔍 [API] Fetching stream info for channel: ${process.env.TWITCH_CHANNEL}`);
        const data = await getTwitchAPI('streams', {
            user_login: process.env.TWITCH_CHANNEL || 'your_channel_name'
        });
        
        console.log(`📊 [API] Received data:`, JSON.stringify(data, null, 2));
        
        if (data.data && data.data.length > 0) {
            const stream = data.data[0];
            streamMetrics.isLive = true;
            streamMetrics.streamTitle = stream.title;
            streamMetrics.gameCategory = stream.game_name;
            streamMetrics.currentViewerCount = stream.viewer_count;
            streamMetrics.streamLanguage = stream.language;
            
            // Update peak viewers
            if (stream.viewer_count > streamMetrics.peakViewerCount) {
                streamMetrics.peakViewerCount = stream.viewer_count;
            }
            
            console.log(`✅ [STREAM] Updated metrics - Live: ${streamMetrics.isLive}, Viewers: ${streamMetrics.currentViewerCount}`);
            return stream;
        } else {
            streamMetrics.isLive = false;
            console.log('❌ [STREAM] No live stream found');
            return null;
        }
    } catch (error) {
        console.error('❌ [API] Error getting stream info:', error);
        return null;
    }
}

// Calculate rolling metrics
function calculateRollingMetrics() {
    const now = Date.now();
    const streamDuration = streamMetrics.streamStartTime ? (now - streamMetrics.streamStartTime) / 60000 : 0; // minutes
    
    if (streamDuration > 0) {
        // Messages per minute
        streamMetrics.messagesPerMinute = streamMetrics.totalMessages / streamDuration;
        
        // Followers per minute
        streamMetrics.followersGainsPerMinute = streamMetrics.sessionFollowersGained / streamDuration;
        
        // Subs per minute
        streamMetrics.subsGainsPerMinute = streamMetrics.sessionSubsGained / streamDuration;
        
        // Bits per minute
        streamMetrics.bitsPerMinute = streamMetrics.sessionBitsEarned / streamDuration;
        
        // Average viewers
        streamMetrics.averageViewerCount = streamMetrics.totalViewerMinutes / streamDuration;
        
        // Viewer retention (simplified calculation)
        streamMetrics.viewerRetention = streamMetrics.currentViewerCount > 0 ? 
            Math.min(100, (streamMetrics.currentViewerCount / Math.max(streamMetrics.peakViewerCount, 1)) * 100) : 0;
    }
}

// Test function
async function testMetrics() {
    console.log('🧪 Testing Twitch metrics system...\n');
    
    // Set stream start time
    streamMetrics.streamStartTime = Date.now();
    
    // Test API call
    console.log('1️⃣ Testing API call...');
    const streamInfo = await getStreamInfo();
    
    if (streamInfo) {
        console.log('\n2️⃣ Testing metrics calculation...');
        calculateRollingMetrics();
        
        console.log('\n📊 Current Metrics:');
        console.log(`   Live: ${streamMetrics.isLive}`);
        console.log(`   Viewers: ${streamMetrics.currentViewerCount}`);
        console.log(`   Peak Viewers: ${streamMetrics.peakViewerCount}`);
        console.log(`   Title: ${streamMetrics.streamTitle}`);
        console.log(`   Game: ${streamMetrics.gameCategory}`);
        console.log(`   Language: ${streamMetrics.streamLanguage}`);
        console.log(`   Messages/min: ${streamMetrics.messagesPerMinute}`);
        console.log(`   Viewer Retention: ${streamMetrics.viewerRetention}%`);
        
        console.log('\n✅ Metrics system is working correctly!');
    } else {
        console.log('❌ Failed to get stream info');
    }
}

testMetrics();
