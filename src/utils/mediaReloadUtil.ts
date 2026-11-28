export function reloadFailedMedia(media: HTMLMediaElement) {
  const resumeAt = media.currentTime
  const src = media.src
  media.load()
  if (!(resumeAt > 0)) return

  const controller = new AbortController()
  const { signal } = controller
  media.addEventListener('seeking', () => controller.abort(), { signal })
  media.addEventListener(
    'loadedmetadata',
    () => {
      controller.abort()
      if (media.src === src && media.currentTime === 0)
        media.currentTime = resumeAt
    },
    { signal }
  )
}
