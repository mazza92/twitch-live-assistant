// Ignore SIGINT temporarily to prevent immediate shutdown
process.on('SIGINT', () => {
    console.log('\n⚠️ [WARNING] SIGINT received but ignoring for debugging...');
    console.log('Press Ctrl+C again to force shutdown');
});

// Load the main server
require('./twitch_data_processor.js');
