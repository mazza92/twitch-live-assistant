// Twitch Bot Diagnostic Script
require('dotenv').config();
const tmi = require('tmi.js');

console.log('🔍 Twitch Bot Diagnostic Tool');
console.log('============================');

// Check environment variables
console.log('\n📋 Environment Check:');
console.log(`Bot Username: ${process.env.TWITCH_BOT_USERNAME}`);
console.log(`OAuth Token: ${process.env.TWITCH_OAUTH_TOKEN ? 'Set' : 'Not Set'}`);
console.log(`Channel: ${process.env.TWITCH_CHANNEL}`);
console.log(`Client ID: ${process.env.TWITCH_CLIENT_ID}`);

// Create Twitch client with debug enabled
const twitchClient = new tmi.Client({
    options: { debug: true },
    connection: {
        reconnect: true,
        secure: true
    },
    identity: {
        username: process.env.TWITCH_BOT_USERNAME || 'your_bot_username',
        password: process.env.TWITCH_OAUTH_TOKEN || 'oauth:your_oauth_token_here'
    },
    channels: [process.env.TWITCH_CHANNEL || 'your_channel_name']
});

// Event handlers for debugging
twitchClient.on('connected', (addr, port) => {
    console.log(`\n✅ Connected to Twitch IRC at ${addr}:${port}`);
    console.log('🔍 Monitoring for events...');
    console.log('📝 Note: Bot needs MODERATOR status to receive sub/bits events');
});

twitchClient.on('disconnected', (reason) => {
    console.log(`❌ Disconnected: ${reason}`);
});

// Monitor all raw messages
twitchClient.on('raw_message', (messageCloned, message) => {
    console.log(`\n🔍 Raw Message:`, message);
    
    // Check for subscription events
    const messageStr = message.raw || JSON.stringify(message);
    if (messageStr.includes('subscribed') || messageStr.includes('submysterygift') || messageStr.includes('subgift')) {
        console.log('🎉 SUBSCRIPTION EVENT DETECTED!');
    }
    
    // Check for bits events
    if (messageStr.includes('cheer') || messageStr.includes('bits')) {
        console.log('💰 BITS EVENT DETECTED!');
    }
    
    // Check for follow events
    if (messageStr.includes('followed')) {
        console.log('👥 FOLLOW EVENT DETECTED!');
    }
});

// Specific event handlers
twitchClient.on('subscription', (channel, username, displayName, subInfo) => {
    console.log(`\n🎉 [SUB EVENT] ${displayName} subscribed!`);
    console.log('Sub info:', subInfo);
});

twitchClient.on('resub', (channel, username, months, message, userstate, methods) => {
    console.log(`\n🎉 [RESUB EVENT] ${username} resubscribed for ${months} months!`);
});

twitchClient.on('subgift', (channel, username, streakMonths, recipient, methods, userstate) => {
    console.log(`\n🎁 [GIFT SUB EVENT] ${username} gifted a sub to ${recipient}!`);
});

twitchClient.on('submysterygift', (channel, username, numbOfSubs, methods, userstate) => {
    console.log(`\n🎁 [MYSTERY GIFT EVENT] ${username} gifted ${numbOfSubs} subs!`);
});

twitchClient.on('cheer', (channel, tags, message) => {
    console.log(`\n💰 [BITS EVENT] ${tags['display-name']} cheered ${tags.bits} bits!`);
    console.log('Tags:', tags);
});

twitchClient.on('follow', (channel, username, displayName, userId) => {
    console.log(`\n👥 [FOLLOW EVENT] ${displayName} followed!`);
});

twitchClient.on('raid', (channel, username, displayName, viewers) => {
    console.log(`\n⚔️ [RAID EVENT] ${displayName} raided with ${viewers} viewers!`);
});

// Connect and run for 30 seconds
console.log('\n🚀 Starting diagnostic...');
twitchClient.connect().catch(console.error);

// Run for 30 seconds then exit
setTimeout(() => {
    console.log('\n⏰ Diagnostic complete. Check the logs above for events.');
    console.log('\n📝 If no events were detected:');
    console.log('1. Make sure the bot is MODERATOR in the channel');
    console.log('2. Check if there are actual subs/bits happening');
    console.log('3. Verify the OAuth token has correct scopes');
    process.exit(0);
}, 30000);
