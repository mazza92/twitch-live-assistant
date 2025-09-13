const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static('.'));

// Test API endpoint
app.post('/api/set-language', (req, res) => {
    console.log('Language API called:', req.body);
    res.json({ success: true, message: 'Language set successfully' });
});

// Test static file serving
app.get('/en.json', (req, res) => {
    res.json({ test: 'English file served successfully' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 [TEST SERVER] Running on port ${PORT}`);
    console.log(`📊 [DASHBOARD] Dashboard available at http://localhost:${PORT}/twitch_dashboard.html`);
    console.log(`🔗 [API] API available at http://localhost:${PORT}/api/set-language`);
});

// Keep server running
process.on('SIGINT', () => {
    console.log('\n🛑 [SHUTDOWN] Shutting down gracefully...');
    server.close(() => {
        console.log('✅ [SHUTDOWN] Server closed');
        process.exit(0);
    });
});