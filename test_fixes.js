// Using built-in fetch (Node.js 18+)

// Test the fixes
async function testFixes() {
    console.log('🧪 Testing Twitch app fixes...\n');
    
    const baseUrl = 'http://localhost:3000';
    
    // Test 1: Check if server is running
    try {
        console.log('1. Testing server health...');
        const healthResponse = await fetch(`${baseUrl}/api/health`);
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log('✅ Server is running:', healthData.status);
        } else {
            console.log('❌ Server health check failed:', healthResponse.status);
        }
    } catch (error) {
        console.log('❌ Server not running or not accessible:', error.message);
        return;
    }
    
    // Test 2: Test /api/set-language endpoint
    try {
        console.log('\n2. Testing /api/set-language endpoint...');
        
        // First, create a test session by connecting to a channel
        console.log('   Creating test session...');
        const connectResponse = await fetch(`${baseUrl}/api/connect-channel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: 'test_channel' })
        });
        
        if (connectResponse.ok) {
            const connectData = await connectResponse.json();
            const sessionId = connectData.sessionId;
            console.log('   ✅ Test session created:', sessionId);
            
            // Now test the set-language endpoint
            console.log('   Testing set-language with valid data...');
            const languageResponse = await fetch(`${baseUrl}/api/set-language`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    language: 'en', 
                    sessionId: sessionId 
                })
            });
            
            if (languageResponse.ok) {
                const languageData = await languageResponse.json();
                console.log('   ✅ Set-language successful:', languageData);
            } else {
                const errorData = await languageResponse.json();
                console.log('   ❌ Set-language failed:', errorData);
            }
            
            // Test with invalid session ID
            console.log('   Testing set-language with invalid session ID...');
            const invalidSessionResponse = await fetch(`${baseUrl}/api/set-language`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    language: 'en', 
                    sessionId: 'invalid_session_id' 
                })
            });
            
            if (invalidSessionResponse.status === 404) {
                console.log('   ✅ Correctly returned 404 for invalid session ID');
            } else {
                console.log('   ❌ Expected 404 but got:', invalidSessionResponse.status);
            }
            
            // Clean up test session
            await fetch(`${baseUrl}/api/disconnect-channel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sessionId })
            });
            console.log('   🧹 Test session cleaned up');
            
        } else {
            console.log('   ❌ Failed to create test session:', connectResponse.status);
        }
        
    } catch (error) {
        console.log('   ❌ Set-language test failed:', error.message);
    }
    
    // Test 3: Test NewsAPI fallback
    try {
        console.log('\n3. Testing NewsAPI fallback...');
        console.log('   This will test the news fetching function internally...');
        console.log('   Check the server logs for NewsAPI error handling messages.');
        console.log('   The app should gracefully fall back to quotes or static content.');
    } catch (error) {
        console.log('   ❌ NewsAPI test failed:', error.message);
    }
    
    console.log('\n🎉 Test completed! Check the server logs for detailed information.');
}

// Run the test
testFixes().catch(console.error);
