/**
 * Migrate Zadara NGOS storage: Old (IL interoplab) → New (US East production)
 *
 * Streams all objects from old bucket to new bucket preserving exact keys.
 * Resumable: skips files that already exist with matching size.
 *
 * Usage:
 *   npx tsx scripts/migrate-storage.ts            # Run migration
 *   npx tsx scripts/migrate-storage.ts --verify    # Verify completeness
 *   npx tsx scripts/migrate-storage.ts --dry-run   # List without transferring
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import https from 'https'
import { Readable } from 'stream'

// Prevent unhandled socket errors from crashing the process
process.on('uncaughtException', (err) => {
  console.error(`\n  [Uncaught] ${err.message} — continuing...`)
})

// --- OLD environment (Israel interoplab — being migrated FROM) ---
const OLD_CONFIG = {
  endpoint: 'https://vsa-00000029-public-il-interoplab-01.zadarazios.com',
  region: 'us-east-1',
  accessKeyId: '14bba297ebed4cc190bb416fa0506979',
  secretAccessKey: '2f9d505979ae405ea4ff10bc5c08d6a2',
  bucketName: 'family-memories',
}

// --- NEW environment (US East production — being migrated TO) ---
const NEW_CONFIG = {
  endpoint: process.env.ZADARA_ENDPOINT ?? '',
  region: process.env.ZADARA_REGION ?? 'us-east-1',
  accessKeyId: process.env.ZADARA_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.ZADARA_SECRET_ACCESS_KEY ?? '',
  bucketName: process.env.ZADARA_BUCKET_NAME ?? 'family-memories',
}

const CONCURRENCY = 3
const MAX_SINGLE_PUT_SIZE = 5 * 1024 * 1024 * 1024 // 5GB S3 single-PUT limit

interface S3Object {
  key: string
  size: number
}

function createClient(cfg: typeof OLD_CONFIG): S3Client {
  const agent = new https.Agent({
    maxSockets: 50,
    keepAlive: true,
    keepAliveMsecs: 1000,
  })

  return new S3Client({
    endpoint: cfg.endpoint,
    forcePathStyle: true, // REQUIRED for Zadara
    region: cfg.region,
    requestStreamBufferSize: 65_536, // Buffer small streams to avoid chunk-size errors
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    requestHandler: new NodeHttpHandler({
      httpsAgent: agent,
      connectionTimeout: 10000,
      socketTimeout: 600000, // 10 min — cross-region transfers need extra time
    }),
  })
}

async function listAllObjects(client: S3Client, bucket: string): Promise<S3Object[]> {
  const objects: S3Object[] = []
  let continuationToken: string | undefined

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    )

    for (const item of response.Contents ?? []) {
      if (item.Key && item.Size !== undefined) {
        objects.push({ key: item.Key, size: item.Size })
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
    process.stdout.write(`\r  Listed ${objects.length} objects...`)
  } while (continuationToken)

  console.log('')
  return objects
}

async function checkExists(
  client: S3Client,
  bucket: string,
  key: string,
  expectedSize: number
): Promise<boolean> {
  try {
    const response = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    )
    return response.ContentLength === expectedSize
  } catch {
    return false
  }
}

const SMALL_FILE_THRESHOLD = 256 * 1024 // 256KB — buffer small files to avoid stream chunk errors

async function migrateObject(
  sourceClient: S3Client,
  destClient: S3Client,
  sourceBucket: string,
  destBucket: string,
  key: string,
  size: number
): Promise<void> {
  const getResponse = await sourceClient.send(
    new GetObjectCommand({ Bucket: sourceBucket, Key: key })
  )

  if (!getResponse.Body) {
    throw new Error(`Empty response body for ${key}`)
  }

  // Small files: buffer entirely to avoid streaming chunk-size errors
  if (size < SMALL_FILE_THRESHOLD) {
    const chunks: Uint8Array[] = []
    for await (const chunk of getResponse.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    await destClient.send(
      new PutObjectCommand({
        Bucket: destBucket,
        Key: key,
        Body: buffer,
        ContentLength: buffer.length,
        ContentType: getResponse.ContentType,
      })
    )
    return
  }

  // Large files: stream directly
  await destClient.send(
    new PutObjectCommand({
      Bucket: destBucket,
      Key: key,
      Body: getResponse.Body as Readable,
      ContentLength: size,
      ContentType: getResponse.ContentType,
    })
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

function getPrefix(key: string): string {
  const slash = key.indexOf('/')
  return slash > 0 ? key.substring(0, slash + 1) : '(root)'
}

// --- Verify mode ---
async function verify(sourceClient: S3Client, destClient: S3Client) {
  console.log('=== Verification Mode ===\n')

  console.log('Listing source objects...')
  const sourceObjects = await listAllObjects(sourceClient, OLD_CONFIG.bucketName)

  console.log('Listing destination objects...')
  const destObjects = await listAllObjects(destClient, NEW_CONFIG.bucketName)

  // Build lookup by key
  const destMap = new Map(destObjects.map(o => [o.key, o.size]))

  // Compare per prefix
  const prefixStats = new Map<string, { source: number; dest: number; missing: string[] }>()

  for (const obj of sourceObjects) {
    const prefix = getPrefix(obj.key)
    if (!prefixStats.has(prefix)) {
      prefixStats.set(prefix, { source: 0, dest: 0, missing: [] })
    }
    const stats = prefixStats.get(prefix)!
    stats.source++

    const destSize = destMap.get(obj.key)
    if (destSize !== undefined && destSize === obj.size) {
      stats.dest++
    } else {
      stats.missing.push(obj.key)
    }
  }

  console.log('\n--- Results by prefix ---\n')
  console.log('Prefix              Source   Dest    Missing')
  console.log('─'.repeat(55))

  let totalMissing = 0
  for (const [prefix, stats] of [...prefixStats.entries()].sort()) {
    const status = stats.missing.length === 0 ? ' ✓' : ` ✗ (${stats.missing.length})`
    console.log(
      `${prefix.padEnd(20)} ${String(stats.source).padStart(6)}  ${String(stats.dest).padStart(6)}  ${status}`
    )
    totalMissing += stats.missing.length
  }

  console.log('─'.repeat(55))
  console.log(
    `${'TOTAL'.padEnd(20)} ${String(sourceObjects.length).padStart(6)}  ${String(sourceObjects.length - totalMissing).padStart(6)}  ${totalMissing === 0 ? ' ✓ All matched!' : ` ✗ ${totalMissing} missing`}`
  )

  if (totalMissing > 0) {
    console.log('\nMissing files:')
    for (const [, stats] of prefixStats) {
      for (const key of stats.missing) {
        console.log(`  ${key}`)
      }
    }
    process.exit(1)
  }

  console.log('\nVerification passed!')
}

// --- Main migration ---
async function migrate(sourceClient: S3Client, destClient: S3Client, dryRun: boolean) {
  console.log('=== Zadara Storage Migration ===')
  console.log(`Source: ${OLD_CONFIG.endpoint}`)
  console.log(`Dest:   ${NEW_CONFIG.endpoint}`)
  if (dryRun) console.log('MODE:   DRY RUN (no transfers)')
  console.log('')

  // Phase 1: List all objects in source
  console.log('Phase 1: Listing objects in source bucket...')
  const objects = await listAllObjects(sourceClient, OLD_CONFIG.bucketName)
  const totalSize = objects.reduce((sum, obj) => sum + obj.size, 0)
  console.log(`Found ${objects.length} objects (${formatBytes(totalSize)} total)\n`)

  // Show breakdown by prefix
  const prefixCounts = new Map<string, { count: number; size: number }>()
  for (const obj of objects) {
    const prefix = getPrefix(obj.key)
    const existing = prefixCounts.get(prefix) ?? { count: 0, size: 0 }
    existing.count++
    existing.size += obj.size
    prefixCounts.set(prefix, existing)
  }

  console.log('Breakdown:')
  for (const [prefix, stats] of [...prefixCounts.entries()].sort()) {
    console.log(`  ${prefix.padEnd(20)} ${String(stats.count).padStart(5)} files  ${formatBytes(stats.size).padStart(10)}`)
  }
  console.log('')

  if (dryRun) {
    console.log('Dry run complete. No files transferred.')
    return
  }

  // Check for oversized files
  const oversized = objects.filter(obj => obj.size > MAX_SINGLE_PUT_SIZE)
  if (oversized.length > 0) {
    console.warn(`WARNING: ${oversized.length} files exceed 5GB single-PUT limit:`)
    oversized.forEach(obj => console.warn(`  ${obj.key} (${formatBytes(obj.size)})`))
    console.warn('These will be skipped.\n')
  }

  const migratable = objects.filter(obj => obj.size <= MAX_SINGLE_PUT_SIZE)

  // Phase 2: Migrate with concurrency
  console.log(`Phase 2: Migrating ${migratable.length} objects (${CONCURRENCY} concurrent)...\n`)

  let completed = 0
  let skipped = 0
  let failed = 0
  let bytesTransferred = 0
  const failures: { key: string; error: string }[] = []
  const startTime = Date.now()

  for (let i = 0; i < migratable.length; i += CONCURRENCY) {
    const batch = migratable.slice(i, i + CONCURRENCY)

    const results = await Promise.allSettled(
      batch.map(async (obj) => {
        // Resumability: skip if already exists with same size
        const exists = await checkExists(destClient, NEW_CONFIG.bucketName, obj.key, obj.size)
        if (exists) {
          skipped++
          return { skipped: true }
        }

        await migrateObject(
          sourceClient, destClient,
          OLD_CONFIG.bucketName, NEW_CONFIG.bucketName,
          obj.key, obj.size
        )
        bytesTransferred += obj.size
        return { skipped: false }
      })
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const obj = batch[j]
      if (result.status === 'fulfilled') {
        completed++
      } else {
        failed++
        const errMsg = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason)
        failures.push({ key: obj.key, error: errMsg })
        console.error(`  FAILED: ${obj.key} — ${errMsg}`)
      }
    }

    // Progress
    const elapsed = (Date.now() - startTime) / 1000
    const speed = elapsed > 0 ? bytesTransferred / elapsed : 0
    const pct = ((completed + skipped + failed) / migratable.length * 100).toFixed(1)
    process.stdout.write(
      `\r  [${pct}%] ${completed + skipped + failed}/${migratable.length} | ` +
      `${formatBytes(bytesTransferred)} transferred | ` +
      `${formatBytes(speed)}/s | ` +
      `${skipped} skipped | ${failed} failed   `
    )
  }

  // Phase 3: Summary
  const totalElapsed = (Date.now() - startTime) / 1000
  console.log('\n\n=== Migration Summary ===')
  console.log(`Total objects:   ${objects.length}`)
  console.log(`Migrated:        ${completed - skipped}`)
  console.log(`Skipped (exist): ${skipped}`)
  console.log(`Failed:          ${failed}`)
  console.log(`Oversized:       ${oversized.length}`)
  console.log(`Bytes moved:     ${formatBytes(bytesTransferred)}`)
  console.log(`Time elapsed:    ${totalElapsed.toFixed(1)}s`)
  if (totalElapsed > 0) {
    console.log(`Avg speed:       ${formatBytes(bytesTransferred / totalElapsed)}/s`)
  }

  if (failures.length > 0) {
    console.log('\nFailed files:')
    failures.forEach(f => console.log(`  ${f.key}: ${f.error}`))
    console.log('\nRe-run the script to retry failed files (existing files will be skipped).')
    process.exit(1)
  }

  console.log('\nMigration complete! Run with --verify to confirm.')
}

// --- Entry point ---
async function main() {
  // Validate new config
  if (!NEW_CONFIG.endpoint || !NEW_CONFIG.accessKeyId || !NEW_CONFIG.secretAccessKey) {
    console.error('ERROR: New environment credentials not found in .env.local')
    console.error('Required: ZADARA_ENDPOINT, ZADARA_ACCESS_KEY_ID, ZADARA_SECRET_ACCESS_KEY')
    process.exit(1)
  }

  const sourceClient = createClient(OLD_CONFIG)
  const destClient = createClient(NEW_CONFIG)

  const args = process.argv.slice(2)

  if (args.includes('--verify')) {
    await verify(sourceClient, destClient)
  } else {
    await migrate(sourceClient, destClient, args.includes('--dry-run'))
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
