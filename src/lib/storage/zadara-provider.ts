import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import https from 'https'
import type { StorageProvider, StorageFile, UploadOptions, FileMetadata } from './types'

interface ZadaraConfig {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicUrl: string
}

function getZadaraConfig(): ZadaraConfig {
  return {
    endpoint: process.env.ZADARA_ENDPOINT ?? '',
    region: process.env.ZADARA_REGION ?? 'us-east-1',
    accessKeyId: process.env.ZADARA_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.ZADARA_SECRET_ACCESS_KEY ?? '',
    bucketName: process.env.ZADARA_BUCKET_NAME ?? 'family-memories',
    publicUrl: process.env.ZADARA_PUBLIC_URL ?? '',
  }
}

export class ZadaraStorageProvider implements StorageProvider {
  private client: S3Client
  private config: ZadaraConfig

  constructor() {
    this.config = getZadaraConfig()

    // Reuse TCP connections and increase pool for concurrent media requests
    const agent = new https.Agent({
      maxSockets: 50,
      keepAlive: true,
      keepAliveMsecs: 1000,
    })

    this.client = new S3Client({
      endpoint: this.config.endpoint,
      forcePathStyle: true, // REQUIRED for Zadara
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      requestHandler: new NodeHttpHandler({
        httpsAgent: agent,
        connectionTimeout: 10000,
        socketTimeout: 300000, // 5 minutes — large uploads (300MB+) need time
      }),
    })
  }

  async upload(path: string, data: Buffer | Uint8Array, options?: UploadOptions): Promise<StorageFile> {
    const sanitizedMetadata = options?.metadata
      ? Object.fromEntries(
          Object.entries(options.metadata).map(([k, v]) => [
            k.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            v,
          ])
        )
      : undefined

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: path,
        Body: data,
        ContentType: options?.contentType,
        Metadata: sanitizedMetadata,
      })
    )

    return { path, size: data.length, contentType: options?.contentType }
  }

  async download(path: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: path,
      })
    )

    const bytes = await response.Body?.transformToByteArray()
    if (!bytes) throw new Error(`Empty response for ${path}`)
    return Buffer.from(bytes)
  }

  async getMetadata(path: string): Promise<FileMetadata> {
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: path,
      })
    )

    return {
      size: response.ContentLength ?? 0,
      contentType: response.ContentType,
      lastModified: response.LastModified,
    }
  }

  async downloadRange(path: string, start: number, end: number): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: path,
        Range: `bytes=${start}-${end}`,
      })
    )

    const bytes = await response.Body?.transformToByteArray()
    if (!bytes) throw new Error(`Empty response for ${path}`)
    return Buffer.from(bytes)
  }

  async downloadRangeStream(path: string, start: number, end: number): Promise<ReadableStream<Uint8Array>> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: path,
        Range: `bytes=${start}-${end}`,
      })
    )

    if (!response.Body) throw new Error(`Empty response for ${path}`)
    return response.Body.transformToWebStream() as ReadableStream<Uint8Array>
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    // Override response Content-Type based on file extension so the browser
    // can identify the format even if the object was uploaded without one
    const { VIDEO_CONTENT_TYPES, AUDIO_CONTENT_TYPES } = await import('@/lib/media/formats')
    const ext = path.substring(path.lastIndexOf('.')).toLowerCase()
    const contentType = VIDEO_CONTENT_TYPES[ext] || AUDIO_CONTENT_TYPES[ext]

    const command = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: path,
      ...(contentType && { ResponseContentType: contentType }),
    })
    return s3GetSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
  }

  async getUploadUrl(path: string, contentType: string, expiresInSeconds = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: path,
      ContentType: contentType,
    })
    return s3GetSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
  }

  getPublicUrl(path: string): string {
    return `${this.config.publicUrl}/${path}`
  }

  async delete(path: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: path,
      })
    )
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucketName,
          Key: path,
        })
      )
      return true
    } catch {
      return false
    }
  }

  async list(prefix: string): Promise<StorageFile[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: prefix,
      })
    )

    return (response.Contents ?? []).map((item) => ({
      path: item.Key ?? '',
      size: item.Size,
      lastModified: item.LastModified,
    }))
  }

  async copy(sourcePath: string, destPath: string): Promise<StorageFile> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.config.bucketName,
        CopySource: `${this.config.bucketName}/${sourcePath}`,
        Key: destPath,
      })
    )
    return { path: destPath }
  }
}
