import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { getStorage } from '@/lib/storage'
import { MediaPaths } from '@/lib/storage/media-paths'
import { getContentType } from '@/lib/media/formats'

// Route config - each chunk is small so we don't need long timeouts
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type UploadType = 'video' | 'thumbnail' | 'intro-video' | 'intro-thumbnail'

// In-memory storage for chunks (for simplicity - in production you might use Redis or temp files)
const uploadSessions = new Map<
  string,
  {
    chunks: Map<number, Buffer>
    totalChunks: number
    filename: string
    contentType: string
    type: UploadType
    id: string
    createdAt: number
  }
>()

// Cleanup old sessions (older than 1 hour)
function cleanupOldSessions() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  for (const [sessionId, session] of uploadSessions) {
    if (session.createdAt < oneHourAgo) {
      uploadSessions.delete(sessionId)
    }
  }
}

// POST: Initialize upload session OR upload a chunk
export async function POST(request: NextRequest) {
  try {
    const err = checkSupabase()
    if (err) return err

    // Cleanup old sessions periodically
    cleanupOldSessions()

    const contentType = request.headers.get('content-type') || ''

    // If JSON, this is an init request
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const { action, type, id, filename, totalChunks, sessionId, chunkIndex, isLastChunk } = body

      if (action === 'init') {
        // Initialize new upload session
        if (!type || !id || !filename || !totalChunks) {
          return errorResponse('Missing required fields: type, id, filename, totalChunks', 400)
        }

        const newSessionId = `${id}-${Date.now()}-${Math.random().toString(36).substring(7)}`

        uploadSessions.set(newSessionId, {
          chunks: new Map(),
          totalChunks,
          filename,
          contentType: getContentType(filename),
          type,
          id,
          createdAt: Date.now(),
        })

        return successResponse({ sessionId: newSessionId })
      }

      if (action === 'complete') {
        // Complete the upload - assemble chunks and upload to storage
        if (!sessionId) {
          return errorResponse('Missing sessionId', 400)
        }

        const session = uploadSessions.get(sessionId)
        if (!session) {
          return errorResponse('Upload session not found or expired', 404)
        }

        // Check if all chunks are received
        if (session.chunks.size !== session.totalChunks) {
          return errorResponse(
            `Missing chunks: received ${session.chunks.size}/${session.totalChunks}`,
            400
          )
        }

        // Assemble the file from chunks
        const sortedChunks: Buffer[] = []
        for (let i = 0; i < session.totalChunks; i++) {
          const chunk = session.chunks.get(i)
          if (!chunk) {
            return errorResponse(`Missing chunk ${i}`, 400)
          }
          sortedChunks.push(chunk)
        }

        const completeFile = Buffer.concat(sortedChunks)

        // Generate storage path
        let storagePath: string
        switch (session.type) {
          case 'video':
            storagePath = MediaPaths.videos(session.id, session.filename)
            break
          case 'thumbnail':
            storagePath = MediaPaths.thumbnails(session.id)
            break
          case 'intro-video':
            storagePath = MediaPaths.introVideos(session.id, session.filename)
            break
          case 'intro-thumbnail':
            storagePath = MediaPaths.introThumbnails(session.id)
            break
          default:
            return errorResponse('Invalid upload type', 400)
        }

        // Upload to storage
        const storage = getStorage()
        await storage.upload(storagePath, completeFile, {
          contentType: session.contentType,
        })

        // Record in media_items table
        await supabase.from('media_items').insert({
          storage_path: storagePath,
          content_type: session.contentType,
          size_bytes: completeFile.length,
          original_filename: session.filename,
        })

        // Update the associated record
        if (session.type === 'video') {
          await supabase
            .from('clips')
            .update({ video_path: storagePath, updated_at: new Date().toISOString() })
            .eq('id', session.id)
        } else if (session.type === 'thumbnail') {
          await supabase
            .from('clips')
            .update({ thumbnail_path: storagePath, updated_at: new Date().toISOString() })
            .eq('id', session.id)
        } else if (session.type === 'intro-video') {
          await supabase
            .from('intro_clips')
            .update({ video_path: storagePath, updated_at: new Date().toISOString() })
            .eq('id', session.id)
        } else if (session.type === 'intro-thumbnail') {
          await supabase
            .from('intro_clips')
            .update({ thumbnail_path: storagePath, updated_at: new Date().toISOString() })
            .eq('id', session.id)
        }

        // Clean up session
        uploadSessions.delete(sessionId)

        return successResponse({
          path: storagePath,
          url: `/api/media/files/${storagePath}`,
          size: completeFile.length,
        })
      }

      return errorResponse('Invalid action', 400)
    }

    // If form-data, this is a chunk upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const sessionId = formData.get('sessionId') as string
      const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10)
      const chunk = formData.get('chunk') as File

      if (!sessionId || isNaN(chunkIndex) || !chunk) {
        return errorResponse('Missing required fields: sessionId, chunkIndex, chunk', 400)
      }

      const session = uploadSessions.get(sessionId)
      if (!session) {
        return errorResponse('Upload session not found or expired', 404)
      }

      // Store the chunk
      const buffer = Buffer.from(await chunk.arrayBuffer())
      session.chunks.set(chunkIndex, buffer)

      return successResponse({
        chunkIndex,
        received: session.chunks.size,
        total: session.totalChunks,
      })
    }

    return errorResponse('Invalid content type', 400)
  } catch (error) {
    console.error('Chunked upload error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// DELETE: Cancel upload session
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (sessionId && uploadSessions.has(sessionId)) {
      uploadSessions.delete(sessionId)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
