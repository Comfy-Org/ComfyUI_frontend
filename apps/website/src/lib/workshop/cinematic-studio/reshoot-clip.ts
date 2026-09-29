/** A clip's length in seconds, read from its metadata; NaN if unreadable. */
export function clipSecondsOf(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = video.onerror = () => resolve(video.duration)
    video.src = url
  })
}

/** A chosen file's length in seconds; NaN if its metadata cannot be read. */
export async function fileSecondsOf(file: File): Promise<number> {
  const url = URL.createObjectURL(file)
  try {
    return await clipSecondsOf(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}
