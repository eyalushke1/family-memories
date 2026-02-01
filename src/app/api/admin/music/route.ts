import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkAdmin } from '@/lib/api/admin-check'
import { successResponse } from '@/lib/api/response'

/**
 * GET /api/admin/music
 * List all music tracks, optionally filtered by category and/or mood
 * Query params:
 *   - categoryId: Filter by category (uses category_music junction table)
 *   - mood: Filter by mood (e.g., "happy", "calm", "romantic", "upbeat")
 *   - genre: Filter by genre (e.g., "acoustic", "classical", "pop")
 */
export async function GET(request: NextRequest) {
  try {
    const adminErr = await checkAdmin(request)
    if (adminErr) return adminErr

    const categoryId = request.nextUrl.searchParams.get('categoryId')
    const mood = request.nextUrl.searchParams.get('mood')
    const genre = request.nextUrl.searchParams.get('genre')
    if (categoryId) {
      // Get music tracks for specific category, with default track first
      const query = supabase
        .from('category_music')
        .select(`
          is_default,
          music_tracks (*)
        `)
        .eq('category_id', categoryId)
        .order('is_default', { ascending: false })

      const { data, error } = await query

      // If table doesn't exist, return empty array
      if (error) {
        const isTableMissing =
          error.code === '42P01' ||
          error.code === 'PGRST116' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('relation') ||
          (error as { hint?: string }).hint?.includes('does not exist')

        if (isTableMissing) {
          console.warn('Music tables not yet created, returning empty array')
          return successResponse([])
        }
        throw error
      }

      let tracks = data?.map((item) => {
        // music_tracks could be a single object or null from the join
        const musicTrack = item.music_tracks as unknown as Record<string, unknown> | null
        if (!musicTrack) return null
        return {
          ...musicTrack,
          isDefault: item.is_default,
        }
      }).filter(Boolean) || []

      // Filter by mood if specified
      if (mood) {
        tracks = tracks.filter((t) => (t as { mood?: string }).mood === mood)
      }

      // Filter by genre if specified
      if (genre) {
        tracks = tracks.filter((t) => (t as { genre?: string }).genre === genre)
      }

      return successResponse(tracks)
    } else {
      // Get all active music tracks with optional mood/genre filters
      let query = supabase
        .from('music_tracks')
        .select('*')
        .eq('is_active', true)

      if (mood) {
        query = query.eq('mood', mood)
      }

      if (genre) {
        query = query.eq('genre', genre)
      }

      const { data, error } = await query.order('name')

      // If table doesn't exist, return empty array
      if (error) {
        const isTableMissing =
          error.code === '42P01' ||
          error.code === 'PGRST116' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('relation') ||
          (error as { hint?: string }).hint?.includes('does not exist')

        if (isTableMissing) {
          console.warn('Music tables not yet created, returning empty array')
          return successResponse([])
        }
        throw error
      }

      return successResponse(data || [])
    }
  } catch (err) {
    // For the music API, we want to gracefully handle all errors
    // and return an empty array since this is not a critical feature
    console.warn('Music API error (returning empty array):', err instanceof Error ? err.message : String(err))
    return successResponse([])
  }
}
