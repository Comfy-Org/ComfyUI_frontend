export function createVideoThumbnail(
  source: string,
  signal: AbortSignal
): Promise<string | undefined> {
  if (signal.aborted) return Promise.resolve(undefined)
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true

  return new Promise((resolve) => {
    let settled = false
    const finish = (url?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
      video.removeEventListener('error', cancel)
      video.removeEventListener('loadeddata', capture)
      video.pause()
      video.removeAttribute('src')
      video.load()
      resolve(url)
    }
    const cancel = () => finish()
    const capture = () => {
      if (!video.videoWidth || !video.videoHeight) return finish()
      try {
        const canvas = document.createElement('canvas')
        const scale = Math.min(
          320 / video.videoWidth,
          320 / video.videoHeight,
          1
        )
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) return finish()
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            if (!settled) finish(blob ? URL.createObjectURL(blob) : undefined)
          },
          'image/jpeg',
          0.8
        )
      } catch {
        finish()
      }
    }
    const timer = setTimeout(cancel, 15_000)
    signal.addEventListener('abort', cancel, { once: true })
    video.addEventListener('error', cancel, { once: true })
    video.addEventListener('loadeddata', capture, { once: true })
    video.src = source
    video.load()
  })
}
