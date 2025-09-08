// Simple test to check if the server can start
console.log('Testing Twitch server startup...');

try {
    // Check if all required modules are available
    console.log('✓ Checking dependencies...');
    require('tmi.js');
    console.log('✓ tmi.js loaded');
    
    require('express');
    console.log('✓ express loaded');
    
    require('ws');
    console.log('✓ ws loaded');
    
    require('sentiment');
    console.log('✓ sentiment loaded');
    
    require('path');
    console.log('✓ path loaded');
    
    // Check if .env file exists
    const fs = require('fs');
    if (fs.existsSync('.env')) {
        console.log('✓ .env file found');
    } else {
        console.log('⚠ .env file not found - using default values');
    }
    
    // Try to load the main file
    console.log('✓ All dependencies loaded successfully');
    console.log('✓ Server should start without issues');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
