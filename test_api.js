// Test Twitch API calls
require('dotenv').config();

const TWITCH_API_CONFIG = {
    clientId: process.env.TWITCH_CLIENT_ID || 'your_client_id',
    clientSecret: process.env.TWITCH_CLIENT_SECRET || 'your_client_secret',
    accessToken: process.env.TWITCH_ACCESS_TOKEN || 'your_access_token'
};

async function getTwitchAPI(endpoint, params = {}) {
    const url = new URL(`https://api.twitch.tv/helix/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    console.log(`🔍 Making API call to: ${url}`);
    console.log(`🔑 Using Client ID: ${TWITCH_API_CONFIG.clientId}`);
    console.log(`🔑 Using Access Token: ${TWITCH_API_CONFIG.accessToken.substring(0, 10)}...`);
    
    const response = await fetch(url, {
        headers: {
            'Client-ID': TWITCH_API_CONFIG.clientId,
            'Authorization': `Bearer ${TWITCH_API_CONFIG.accessToken}`
        }
    });
    
    console.log(`📊 Response status: ${response.status}`);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status} - ${errorText}`);
        throw new Error(`Twitch API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ API Response:`, JSON.stringify(data, null, 2));
    return data;
}

async function testStreamInfo() {
    try {
        console.log('🧪 Testing Twitch API calls...\n');
        
        // Test stream info
        console.log('1️⃣ Testing stream info...');
        const streamData = await getTwitchAPI('streams', {
            user_login: process.env.TWITCH_CHANNEL || 'ishowspeed'
        });
        
        if (streamData.data && streamData.data.length > 0) {
            const stream = streamData.data[0];
            console.log(`\n📺 Stream Found:`);
            console.log(`   Title: ${stream.title}`);
            console.log(`   Game: ${stream.game_name}`);
            console.log(`   Viewers: ${stream.viewer_count}`);
            console.log(`   Language: ${stream.language}`);
            console.log(`   Type: ${stream.type}`);
        } else {
            console.log('❌ No stream data found');
        }
        
        // Test user info
        console.log('\n2️⃣ Testing user info...');
        const userData = await getTwitchAPI('users', {
            login: process.env.TWITCH_CHANNEL || 'ishowspeed'
        });
        
        if (userData.data && userData.data.length > 0) {
            const user = userData.data[0];
            console.log(`\n👤 User Found:`);
            console.log(`   ID: ${user.id}`);
            console.log(`   Login: ${user.login}`);
            console.log(`   Display Name: ${user.display_name}`);
            console.log(`   Description: ${user.description.substring(0, 100)}...`);
        } else {
            console.log('❌ No user data found');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testStreamInfo();
