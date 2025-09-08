// Check if bot has moderator status
require('dotenv').config();
const tmi = require('tmi.js');

console.log('🔍 Checking Bot Moderator Status');
console.log('================================');

const twitchClient = new tmi.Client({
    options: { debug: false },
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

twitchClient.on('connected', (addr, port) => {
    console.log(`✅ Connected to Twitch IRC at ${addr}:${port}`);
    console.log(`📺 Monitoring channel: ${process.env.TWITCH_CHANNEL}`);
    console.log('🔍 Checking for moderator status...');
});

twitchClient.on('message', (channel, tags, message, self) => {
    if (self) return; // Ignore bot's own messages
    
    // Check if bot has moderator privileges
    if (tags.mod === '1') {
        console.log('✅ Bot has MODERATOR status!');
    } else if (tags.badges && tags.badges.includes('moderator')) {
        console.log('✅ Bot has MODERATOR status!');
    } else {
        console.log('❌ Bot does NOT have moderator status');
        console.log('📝 Bot tags:', tags);
    }
});

twitchClient.on('usernotice', (channel, tags, message) => {
    console.log('🎉 USERNOTICE EVENT (Subs/Bits):', tags);
});

twitchClient.on('raw_message', (messageCloned, message) => {
    if (message.raw && message.raw.includes('USERNOTICE')) {
        console.log('🎉 USERNOTICE DETECTED:', message.raw);
    }
});

// Connect and run for 10 seconds
twitchClient.connect().catch(console.error);

setTimeout(() => {
    console.log('\n⏰ Check complete.');
    console.log('\n📝 If bot is not a moderator:');
    console.log('1. Go to the Twitch channel');
    console.log('2. Type: /mod ' + process.env.TWITCH_BOT_USERNAME);
    console.log('3. Or add the bot as moderator in channel settings');
    process.exit(0);
}, 10000);
