import { create } from 'zustand'
import type { ProfileRow, CategoryRow, ClipRow } from '@/types/database'

interface AdminState {
  // Data
  profiles: ProfileRow[]
  categories: CategoryRow[]
  clips: ClipRow[]

  // Loading states
  loadingProfiles: boolean
  loadingCategories: boolean
  loadingClips: boolean

  // Actions - Profiles
  setProfiles: (profiles: ProfileRow[]) => void
  addProfile: (profile: ProfileRow) => void
  updateProfile: (id: string, data: Partial<ProfileRow>) => void
  removeProfile: (id: string) => void

  // Actions - Categories
  setCategories: (categories: CategoryRow[]) => void
  addCategory: (category: CategoryRow) => void
  updateCategory: (id: string, data: Partial<CategoryRow>) => void
  removeCategory: (id: string) => void
  reorderCategories: (categories: CategoryRow[]) => void

  // Actions - Clips
  setClips: (clips: ClipRow[]) => void
  addClip: (clip: ClipRow) => void
  updateClip: (id: string, data: Partial<ClipRow>) => void
  removeClip: (id: string) => void
  reorderClips: (categoryId: string, clips: ClipRow[]) => void

  // Loading actions
  setLoadingProfiles: (loading: boolean) => void
  setLoadingCategories: (loading: boolean) => void
  setLoadingClips: (loading: boolean) => void
}

export const useAdminStore = create<AdminState>((set) => ({
  profiles: [],
  categories: [],
  clips: [],
  loadingProfiles: false,
  loadingCategories: false,
  loadingClips: false,

  // Profiles
  setProfiles: (profiles) => set({ profiles }),
  addProfile: (profile) =>
    set((state) => ({ profiles: [...state.profiles, profile] })),
  updateProfile: (id, data) =>
    set((state) => ({
      profiles: state.profiles.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    })),
  removeProfile: (id) =>
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
    })),

  // Categories
  setCategories: (categories) => set({ categories }),
  addCategory: (category) =>
    set((state) => ({ categories: [...state.categories, category] })),
  updateCategory: (id, data) =>
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    })),
  removeCategory: (id) =>
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    })),
  reorderCategories: (categories) => set({ categories }),

  // Clips
  setClips: (clips) => set({ clips }),
  addClip: (clip) => set((state) => ({ clips: [...state.clips, clip] })),
  updateClip: (id, data) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })),
  removeClip: (id) =>
    set((state) => ({ clips: state.clips.filter((c) => c.id !== id) })),
  reorderClips: (categoryId, reorderedClips) =>
    set((state) => ({
      clips: [
        ...state.clips.filter((c) => c.category_id !== categoryId),
        ...reorderedClips,
      ],
    })),

  // Loading
  setLoadingProfiles: (loadingProfiles) => set({ loadingProfiles }),
  setLoadingCategories: (loadingCategories) => set({ loadingCategories }),
  setLoadingClips: (loadingClips) => set({ loadingClips }),
}))
