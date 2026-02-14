export interface Database {
  family_memories: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          avatar_path: string | null
          is_hidden: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          avatar_path?: string | null
          is_hidden?: boolean
        }
        Update: {
          name?: string
          avatar_path?: string | null
          is_hidden?: boolean
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          name: string
          slug: string
          sort_order?: number
          is_active?: boolean
        }
        Update: {
          name?: string
          slug?: string
          sort_order?: number
          is_active?: boolean
        }
      }
      clips: {
        Row: {
          id: string
          title: string
          description: string | null
          category_id: string
          video_path: string
          thumbnail_path: string | null
          animated_thumbnail_path: string | null
          duration_seconds: number | null
          sort_order: number
          is_active: boolean
          intro_clip_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          title: string
          category_id: string
          video_path: string
          description?: string | null
          thumbnail_path?: string | null
          animated_thumbnail_path?: string | null
          duration_seconds?: number | null
          sort_order?: number
          is_active?: boolean
          intro_clip_id?: string | null
        }
        Update: {
          title?: string
          description?: string | null
          category_id?: string
          video_path?: string
          thumbnail_path?: string | null
          animated_thumbnail_path?: string | null
          duration_seconds?: number | null
          sort_order?: number
          is_active?: boolean
          intro_clip_id?: string | null
          updated_at?: string
        }
      }
      intro_clips: {
        Row: {
          id: string
          name: string
          description: string | null
          video_path: string
          thumbnail_path: string | null
          duration_seconds: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          video_path: string
          description?: string | null
          thumbnail_path?: string | null
          duration_seconds?: number | null
          is_active?: boolean
        }
        Update: {
          name?: string
          description?: string | null
          video_path?: string
          thumbnail_path?: string | null
          duration_seconds?: number | null
          is_active?: boolean
          updated_at?: string
        }
      }
      media_items: {
        Row: {
          id: string
          storage_path: string
          content_type: string
          size_bytes: number
          original_filename: string | null
          created_at: string
        }
        Insert: {
          storage_path: string
          content_type: string
          size_bytes: number
          original_filename?: string | null
        }
        Update: never
      }
      clip_profiles: {
        Row: {
          clip_id: string
          profile_id: string
          created_at: string
        }
        Insert: {
          clip_id: string
          profile_id: string
        }
        Update: never
      }
      google_oauth_tokens: {
        Row: {
          id: string
          profile_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          scope: string
          created_at: string
          updated_at: string
        }
        Insert: {
          profile_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          scope: string
        }
        Update: {
          access_token?: string
          refresh_token?: string
          expires_at?: string
          scope?: string
          updated_at?: string
        }
      }
      presentations: {
        Row: {
          id: string
          clip_id: string
          slide_duration_ms: number
          transition_type: string
          transition_duration_ms: number
          background_music_path: string | null
          music_fade_out_ms: number
          mute_video_audio: boolean
          created_at: string
        }
        Insert: {
          clip_id: string
          slide_duration_ms?: number
          transition_type?: string
          transition_duration_ms?: number
          background_music_path?: string | null
          music_fade_out_ms?: number
          mute_video_audio?: boolean
        }
        Update: {
          slide_duration_ms?: number
          transition_type?: string
          transition_duration_ms?: number
          background_music_path?: string | null
          music_fade_out_ms?: number
          mute_video_audio?: boolean
        }
      }
      presentation_slides: {
        Row: {
          id: string
          presentation_id: string
          image_path: string
          media_type: 'image' | 'video'
          sort_order: number
          caption: string | null
          duration_ms: number | null
          google_photos_id: string | null
          created_at: string
        }
        Insert: {
          presentation_id: string
          image_path: string
          media_type?: 'image' | 'video'
          sort_order?: number
          caption?: string | null
          duration_ms?: number | null
          google_photos_id?: string | null
        }
        Update: {
          image_path?: string
          media_type?: 'image' | 'video'
          sort_order?: number
          caption?: string | null
          duration_ms?: number | null
        }
      }
      google_photos_imports: {
        Row: {
          id: string
          google_media_id: string
          storage_path: string
          original_filename: string | null
          media_type: string
          imported_by: string
          imported_at: string
        }
        Insert: {
          google_media_id: string
          storage_path: string
          original_filename?: string | null
          media_type: string
          imported_by: string
        }
        Update: never
      }
      music_tracks: {
        Row: {
          id: string
          name: string
          artist: string | null
          audio_path: string
          duration_seconds: number | null
          genre: string | null
          mood: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          name: string
          artist?: string | null
          audio_path: string
          duration_seconds?: number | null
          genre?: string | null
          mood?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          artist?: string | null
          audio_path?: string
          duration_seconds?: number | null
          genre?: string | null
          mood?: string | null
          is_active?: boolean
        }
      }
      category_music: {
        Row: {
          category_id: string
          music_track_id: string
          is_default: boolean
          created_at: string
        }
        Insert: {
          category_id: string
          music_track_id: string
          is_default?: boolean
        }
        Update: {
          is_default?: boolean
        }
      }
      supabase_keepalive_projects: {
        Row: {
          id: string
          name: string
          supabase_url: string
          service_key: string
          is_active: boolean
          last_ping_at: string | null
          last_ping_status: string
          last_ping_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          supabase_url: string
          service_key: string
          is_active?: boolean
        }
        Update: {
          name?: string
          supabase_url?: string
          service_key?: string
          is_active?: boolean
          last_ping_at?: string
          last_ping_status?: string
          last_ping_error?: string | null
          updated_at?: string
        }
      }
    }
  }
}

// Flat type aliases
export type ProfileRow = Database['family_memories']['Tables']['profiles']['Row']
export type InsertProfile = Database['family_memories']['Tables']['profiles']['Insert']
export type UpdateProfile = Database['family_memories']['Tables']['profiles']['Update']

export type CategoryRow = Database['family_memories']['Tables']['categories']['Row']
export type InsertCategory = Database['family_memories']['Tables']['categories']['Insert']
export type UpdateCategory = Database['family_memories']['Tables']['categories']['Update']

export type ClipRow = Database['family_memories']['Tables']['clips']['Row'] & {
  presentation?: { id: string } | null
}
export type InsertClip = Database['family_memories']['Tables']['clips']['Insert']
export type UpdateClip = Database['family_memories']['Tables']['clips']['Update']

export type MediaItemRow = Database['family_memories']['Tables']['media_items']['Row']
export type InsertMediaItem = Database['family_memories']['Tables']['media_items']['Insert']

export type IntroClipRow = Database['family_memories']['Tables']['intro_clips']['Row']
export type InsertIntroClip = Database['family_memories']['Tables']['intro_clips']['Insert']
export type UpdateIntroClip = Database['family_memories']['Tables']['intro_clips']['Update']

export type ClipProfileRow = Database['family_memories']['Tables']['clip_profiles']['Row']
export type InsertClipProfile = Database['family_memories']['Tables']['clip_profiles']['Insert']

export type GoogleOAuthTokenRow = Database['family_memories']['Tables']['google_oauth_tokens']['Row']
export type InsertGoogleOAuthToken = Database['family_memories']['Tables']['google_oauth_tokens']['Insert']
export type UpdateGoogleOAuthToken = Database['family_memories']['Tables']['google_oauth_tokens']['Update']

export type PresentationRow = Database['family_memories']['Tables']['presentations']['Row']
export type InsertPresentation = Database['family_memories']['Tables']['presentations']['Insert']
export type UpdatePresentation = Database['family_memories']['Tables']['presentations']['Update']

export type PresentationSlideRow = Database['family_memories']['Tables']['presentation_slides']['Row']
export type InsertPresentationSlide = Database['family_memories']['Tables']['presentation_slides']['Insert']
export type UpdatePresentationSlide = Database['family_memories']['Tables']['presentation_slides']['Update']

export type GooglePhotosImportRow = Database['family_memories']['Tables']['google_photos_imports']['Row']
export type InsertGooglePhotosImport = Database['family_memories']['Tables']['google_photos_imports']['Insert']

export type MusicTrackRow = Database['family_memories']['Tables']['music_tracks']['Row']
export type InsertMusicTrack = Database['family_memories']['Tables']['music_tracks']['Insert']
export type UpdateMusicTrack = Database['family_memories']['Tables']['music_tracks']['Update']

export type CategoryMusicRow = Database['family_memories']['Tables']['category_music']['Row']
export type InsertCategoryMusic = Database['family_memories']['Tables']['category_music']['Insert']
export type UpdateCategoryMusic = Database['family_memories']['Tables']['category_music']['Update']

export type KeepAliveProjectRow = Database['family_memories']['Tables']['supabase_keepalive_projects']['Row']
export type InsertKeepAliveProject = Database['family_memories']['Tables']['supabase_keepalive_projects']['Insert']
export type UpdateKeepAliveProject = Database['family_memories']['Tables']['supabase_keepalive_projects']['Update']
