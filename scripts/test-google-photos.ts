/**
 * Test script to verify Google Photos API access
 * Run with: npx tsx scripts/test-google-photos.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { google } from 'googleapis'

async function testGooglePhotosAPI() {
  console.log('=== Google Photos API Test ===\n')

  // Check environment variables
  console.log('1. Checking environment variables...')
  console.log('   GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing')
  console.log('   GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing')
  console.log('   GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI)
  console.log('')

  // Create OAuth2 client - use OOB redirect for testing
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/test-callback'  // Different redirect for testing
  )

  // Generate auth URL
  console.log('2. Generating authorization URL...')
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/photoslibrary.readonly'],
    prompt: 'consent',
  })

  console.log('\n   Visit this URL to authorize:')
  console.log('   ' + authUrl)
  console.log('')

  // If we have a code from command line, exchange it
  const code = process.argv[2]
  if (code) {
    console.log('3. Exchanging code for tokens...')
    try {
      const { tokens } = await oauth2Client.getToken(code)
      console.log('   Access token:', tokens.access_token?.substring(0, 30) + '...')
      console.log('   Refresh token:', tokens.refresh_token ? '✓ Received' : '✗ Missing')
      console.log('   Scope:', tokens.scope)
      console.log('   Expiry:', tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'Unknown')
      console.log('')

      // Test the API directly
      console.log('4. Testing Google Photos API...')
      const response = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=10', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      console.log('   Response status:', response.status)
      const data = await response.text()
      console.log('   Response body:', data.substring(0, 500))

      if (response.ok) {
        const json = JSON.parse(data)
        console.log('\n   ✓ SUCCESS! Found', json.albums?.length || 0, 'albums')
      } else {
        console.log('\n   ✗ FAILED:', response.status)
      }
    } catch (err) {
      console.error('   Error:', err)
    }
  } else {
    console.log('3. To test token exchange, run:')
    console.log('   npx tsx scripts/test-google-photos.ts "YOUR_AUTH_CODE"')
    console.log('')
    console.log('   Get the auth code from the URL after authorizing.')
    console.log('   It will be in the "code" parameter of the redirect URL.')
  }
}

testGooglePhotosAPI().catch(console.error)
