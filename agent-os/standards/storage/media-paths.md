# Media Path Helpers

Use `MediaPaths` for consistent storage paths.

```ts
import { MediaPaths } from '@/lib/storage';

// Avatars
MediaPaths.avatars(profileId, 'avatar.jpg')
// → 'avatars/123/avatar.jpg'

// Thumbnails
MediaPaths.thumbnails(presentationId)
// → 'thumbnails/456.jpg'

// Videos
MediaPaths.videos(presentationId)
// → 'videos/456.mp4'

// Source media
MediaPaths.sourceMedia(presentationId, 'photo.jpg')
// → 'presentations/456/source/photo.jpg'

// Project files
MediaPaths.projects(presentationId)
// → 'presentations/456/project.json'
```

**Why:** Centralizes path logic, prevents typos, easy to refactor.
