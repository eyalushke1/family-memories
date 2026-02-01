export const MediaPaths = {
  avatars: (profileId: string, filename: string) =>
    `avatars/${profileId}/${filename}`,

  thumbnails: (clipId: string) =>
    `thumbnails/${clipId}.webp`,

  animatedThumbnails: (clipId: string) =>
    `thumbnails/${clipId}-animated.webp`,

  videos: (clipId: string, filename: string) =>
    `videos/${clipId}/${filename}`,

  // Intro clips (stored in separate folder)
  introVideos: (introId: string, filename: string) =>
    `intros/${introId}/${filename}`,

  introThumbnails: (introId: string) =>
    `intros/${introId}/thumbnail.webp`,

  // Presentation slides
  presentationSlides: (presentationId: string, slideId: string, extension: string) =>
    `presentations/${presentationId}/slides/${slideId}.${extension}`,

  // Background music for presentations
  presentationMusic: (presentationId: string, filename: string) =>
    `presentations/${presentationId}/music/${filename}`,

  // Google Photos imports (organized by date for easy browsing)
  googlePhotosImport: (year: string, month: string, filename: string) =>
    `google-photos/${year}/${month}/${filename}`,
}
