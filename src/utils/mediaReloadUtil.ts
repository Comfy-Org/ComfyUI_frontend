export function reloadFailedMedia(media: HTMLMediaElement) {
  const resumeAt = media.currentTime
  const src = media.src
  media.load()
  if (!(resumeAt > 0)) return
  media.addEventListener(
    'loadedmetadata',
    () => {
      if (media.src === src) media.currentTime = resumeAt
    },
    { once: true }
  )
}
