import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import type { CategoryRow, ClipRow } from '@/types/database'

interface BrowseClip {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  animated_thumbnail_url: string | null
  duration_seconds: number | null
  sort_order: number
}

interface BrowseCategory {
  id: string
  name: string
  slug: string
  clips: BrowseClip[]
}

function toProxyUrl(path: string | null): string | null {
  if (!path) return null
  return `/api/media/files/${path}`
}

export async function GET() {
  const err = checkSupabase()
  if (err) return err

  // Fetch categories
  const { data: rawCategories, error: catError } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (catError) {
    console.error('Failed to fetch categories:', catError)
    return errorResponse(`Failed to fetch categories: ${catError.message}`)
  }

  const categories = rawCategories as CategoryRow[] | null
  if (!categories || categories.length === 0) {
    return successResponse([])
  }

  // Fetch all active clips
  const { data: rawClips, error: clipError } = await supabase
    .from('clips')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (clipError) {
    console.error('Failed to fetch clips:', clipError)
    return errorResponse(`Failed to fetch clips: ${clipError.message}`)
  }

  const clips = rawClips as ClipRow[] | null

  // Group clips by category
  const clipsByCategory = new Map<string, BrowseClip[]>()
  for (const clip of clips ?? []) {
    const categoryClips = clipsByCategory.get(clip.category_id) ?? []
    categoryClips.push({
      id: clip.id,
      title: clip.title,
      description: clip.description,
      thumbnail_url: toProxyUrl(clip.thumbnail_path),
      animated_thumbnail_url: toProxyUrl(clip.animated_thumbnail_path),
      duration_seconds: clip.duration_seconds,
      sort_order: clip.sort_order,
    })
    clipsByCategory.set(clip.category_id, categoryClips)
  }

  // Build response — only include categories that have clips
  const browseData: BrowseCategory[] = categories
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      clips: clipsByCategory.get(cat.id) ?? [],
    }))
    .filter((cat) => cat.clips.length > 0)

  return successResponse(browseData)
}
