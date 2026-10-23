function settle<T extends Event>(target: EventTarget, name: string) {
  return new Promise<T>((resolve, reject) => {
    target.addEventListener(name, (event) => resolve(event as T), {
      once: true
    })
    target.addEventListener('error', () => reject(new Error(name)), {
      once: true
    })
  })
}

/** The clip's frame at `start` seconds, as a PNG at the clip's own size. */
export async function frameAt(video: File, start: number): Promise<Blob> {
  const url = URL.createObjectURL(video)
  const element = document.createElement('video')
  element.muted = true
  element.preload = 'auto'
  element.src = url
  try {
    await settle(element, 'loadeddata')
    const seeked = settle(element, 'seeked')
    element.currentTime = start
    await seeked
    const canvas = document.createElement('canvas')
    canvas.width = element.videoWidth
    canvas.height = element.videoHeight
    canvas.getContext('2d')?.drawImage(element, 0, 0)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('frame'))),
        'image/png'
      )
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
