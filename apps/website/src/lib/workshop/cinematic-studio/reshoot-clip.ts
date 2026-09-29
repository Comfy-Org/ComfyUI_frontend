/** A clip's length in seconds, read from its metadata; NaN if unreadable. */
export function clipSecondsOf(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = video.onerror = () => resolve(video.duration)
    video.src = url
  })
}
