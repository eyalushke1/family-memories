# Product Roadmap

## Phase 1: MVP

### Profile Selection
- Profile picker screen with avatar display (Netflix-style grid)
- Multiple user profiles per household
- Avatar selection/upload for each profile

### Browse Experience
- Category-based horizontal rows of clips (Netflix layout)
- Thumbnail previews with hover/focus preview playback
- Smooth scroll and row navigation
- Dark cinematic theme throughout
- Dynamic transitions and animations between screens (page enter/exit, row focus, card expand)

### Video Player
- Netflix-style player UI: progress bar, play/pause, skip forward/back, volume
- Fullscreen support
- Auto-play next clip option
- Loading states and buffering indicator

### Admin Panel
- Add new clips (upload to Zadara NGOS storage)
- Edit clip metadata (title, description, category, thumbnail)
- Archive and delete clips
- Manage categories (create, rename, reorder, delete)
- Manage user profiles (create, edit avatar, delete)

### Media Storage
- Zadara NGOS S3-compatible storage for all video/image files
- API proxy for media delivery (never expose direct storage URLs)
- Thumbnail generation and storage

### Platform Support
- Responsive web UI (desktop browsers)
- TV-optimized layout (large screens, remote-friendly navigation)
- Deployed on Google Cloud Run

## Phase 2: Post-Launch

### Smart Features
- AI-powered auto-tagging of clips (people, places, events)
- Face recognition to tag family members across clips
- Auto-generated highlights/compilations from longer videos
- Search by person, place, or date
- Smart categories that auto-populate based on tags

### Experience Enhancements
- Continue watching / recently watched
- Favorites and personal playlists per profile
- Clip details overlay with metadata and tags
- Improved TV remote navigation (D-pad optimized)
