/**
 * Configure CORS on the Zadara bucket to allow direct browser access via signed URLs.
 *
 * This enables the video player to fetch media directly from Zadara storage
 * instead of proxying through Cloud Run, dramatically reducing latency.
 *
 * Usage: npx tsx scripts/setup-zadara-cors.ts
 */

import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3'
import 'dotenv/config'

const client = new S3Client({
  endpoint: process.env.ZADARA_ENDPOINT,
  forcePathStyle: true,
  region: process.env.ZADARA_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.ZADARA_ACCESS_KEY_ID!,
    secretAccessKey: process.env.ZADARA_SECRET_ACCESS_KEY!,
  },
})

const bucket = process.env.ZADARA_BUCKET_NAME ?? 'family-memories'

async function setupCors() {
  console.log(`Setting CORS on bucket: ${bucket}`)

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            // Allow browser video/audio requests from any origin
            AllowedOrigins: ['*'],
            AllowedMethods: ['GET', 'HEAD'],
            AllowedHeaders: ['Range', 'Content-Type'],
            ExposeHeaders: [
              'Content-Range',
              'Content-Length',
              'Accept-Ranges',
              'Content-Type',
            ],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    })
  )

  console.log('CORS configured successfully!')

  // Verify
  const result = await client.send(
    new GetBucketCorsCommand({ Bucket: bucket })
  )
  console.log('Current CORS rules:', JSON.stringify(result.CORSRules, null, 2))
}

setupCors().catch(console.error)
