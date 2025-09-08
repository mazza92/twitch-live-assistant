// Test script to verify session data is being sent correctly
const express = require('express');
const app = express();

// Mock stream metrics
const streamMetrics = {
    streamStartTime: Date.now(),
    currentViewerCount: 25000,
    peakViewerCount: 30000,
    totalMessages: 150,
    isLive: true,
    streamTitle: "Test Stream",
    gameCategory: "Just Chatting"
};

// Test API endpoint
app.get('/api/metrics', (req, res) => {
    const data = {
        ...streamMetrics,
        channelName: 'kamet0',
        sessionId: streamMetrics.streamStartTime,
        timestamp: Date.now()
    };
    
    console.log('📊 Test API Response:', JSON.stringify(data, null, 2));
    res.json(data);
});

// Test WebSocket data format
const testWebSocketData = {
    ...streamMetrics,
    channelName: 'kamet0',
    sessionId: streamMetrics.streamStartTime,
    timestamp: Date.now()
};

console.log('🔌 Test WebSocket Data:', JSON.stringify(testWebSocketData, null, 2));

const server = app.listen(3001, () => {
    console.log('✅ Test server running on port 3001');
    console.log('📊 Test API: http://localhost:3001/api/metrics');
    console.log('🔍 Check the data format above');
});

// Auto-shutdown after 10 seconds
setTimeout(() => {
    console.log('🛑 Shutting down test server');
    server.close();
    process.exit(0);
}, 10000);
