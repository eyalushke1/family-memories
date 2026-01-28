export interface Database {
  family_memories: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          avatar_path: string | null
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          avatar_path?: string | null
          is_admin?: boolean
        }
        Update: {
          name?: string
          avatar_path?: string | null
          is_admin?: boolean
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

export type ClipRow = Database['family_memories']['Tables']['clips']['Row']
export type InsertClip = Database['family_memories']['Tables']['clips']['Insert']
export type UpdateClip = Database['family_memories']['Tables']['clips']['Update']

export type MediaItemRow = Database['family_memories']['Tables']['media_items']['Row']
export type InsertMediaItem = Database['family_memories']['Tables']['media_items']['Insert']
