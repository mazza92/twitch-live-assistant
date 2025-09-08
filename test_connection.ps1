# Test script to connect to a Twitch channel
# Change the channel name below to test with different channels
$testChannel = 'medzn'  # Change this to any Twitch channel name

Write-Host "🧪 [TEST] Connecting to test channel: $testChannel"
$body = @{channel=$testChannel} | ConvertTo-Json
$response = Invoke-RestMethod -Uri 'http://localhost:3000/api/connect-channel' -Method POST -Body $body -ContentType 'application/json'
Write-Host "✅ [TEST] Connection result: $($response | ConvertTo-Json)"
