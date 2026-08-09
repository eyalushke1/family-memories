import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { SharePlayer } from '@/components/share/share-player'

interface PageProps {
  params: Promise<{ shareToken: string }>
}

// Server-side metadata for OG tags (WhatsApp/email link previews)
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareToken } = await params

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY
  const schema = process.env.SUPABASE_SCHEMA || 'family_memories'

  if (!supabaseUrl || !supabaseKey) {
    return { title: 'Shared Clip' }
  }

  const sb = createClient(supabaseUrl, supabaseKey, { db: { schema } })

  const { data: share } = await sb
    .from('shared_clips')
    .select('clip_id, is_active, expires_at')
    .eq('share_token', shareToken)
    .single()

  // Mirror the checks in GET /api/shares/[shareToken]. Without the expiry check
  // an expired link still exposes the clip title, description and thumbnail
  // through the page title and OG tags — including in WhatsApp/email previews.
  const isExpired = !!share?.expires_at && new Date(share.expires_at) < new Date()

  if (!share || !share.is_active || isExpired) {
    return { title: 'Link Expired' }
  }

  const { data: clip } = await sb
    .from('clips')
    .select('title, description, thumbnail_path')
    .eq('id', share.clip_id)
    .single()

  if (!clip) {
    return { title: 'Shared Clip' }
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Family Memories'

  return {
    title: `${clip.title} — ${appName}`,
    description: clip.description || `Shared from ${appName}`,
    openGraph: {
      title: clip.title,
      description: clip.description || `Shared from ${appName}`,
      type: 'video.other',
      ...(clip.thumbnail_path ? {
        images: [{
          url: `/api/media/files/${clip.thumbnail_path}`,
          width: 1280,
          height: 720,
        }],
      } : {}),
    },
  }
}

export default async function SharePage({ params }: PageProps) {
  const { shareToken } = await params

  return (
    <div className="min-h-screen bg-black">
      <SharePlayer shareToken={shareToken} />
    </div>
  )
}
