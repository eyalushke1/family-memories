export const MediaPaths = {
  avatars: (profileId: string, filename: string) =>
    `avatars/${profileId}/${filename}`,

  thumbnails: (clipId: string) =>
    `thumbnails/${clipId}.webp`,

  animatedThumbnails: (clipId: string) =>
    `thumbnails/${clipId}-animated.webp`,

  videos: (clipId: string, filename: string) =>
    `videos/${clipId}/${filename}`,
}
