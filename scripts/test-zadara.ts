/**
 * Test Zadara NGOS connection
 * Usage: STORAGE_TYPE=zadara npx tsx scripts/test-zadara.ts
 */

async function testZadara() {
  // Force Zadara storage type
  process.env.STORAGE_TYPE = 'zadara'

  const { getStorage, resetStorageInstance } = await import('../src/lib/storage')

  resetStorageInstance()
  const storage = getStorage()

  const testPath = 'test/connection-test.txt'
  const testData = Buffer.from('Zadara connection test - ' + new Date().toISOString())

  console.log('1. Testing config validation...')
  const requiredVars = ['ZADARA_ENDPOINT', 'ZADARA_ACCESS_KEY_ID', 'ZADARA_SECRET_ACCESS_KEY', 'ZADARA_BUCKET_NAME']
  for (const v of requiredVars) {
    if (!process.env[v]) {
      console.error(`   Missing env var: ${v}`)
      process.exit(1)
    }
    console.log(`   ${v}: OK`)
  }

  console.log('\n2. Testing upload...')
  await storage.upload(testPath, testData, { contentType: 'text/plain' })
  console.log('   Upload: OK')

  console.log('\n3. Testing exists...')
  const exists = await storage.exists(testPath)
  console.log(`   Exists: ${exists}`)

  console.log('\n4. Testing download...')
  const downloaded = await storage.download(testPath)
  console.log(`   Downloaded ${downloaded.length} bytes`)
  console.log(`   Content matches: ${downloaded.toString() === testData.toString()}`)

  console.log('\n5. Testing list...')
  const files = await storage.list('test/')
  console.log(`   Found ${files.length} files in test/`)

  console.log('\n6. Testing signed URL...')
  const url = await storage.getSignedUrl(testPath, 60)
  console.log(`   Signed URL: ${url.substring(0, 80)}...`)

  console.log('\n7. Testing delete...')
  await storage.delete(testPath)
  const existsAfterDelete = await storage.exists(testPath)
  console.log(`   Deleted. Exists after delete: ${existsAfterDelete}`)

  console.log('\nAll tests passed!')
}

testZadara().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
