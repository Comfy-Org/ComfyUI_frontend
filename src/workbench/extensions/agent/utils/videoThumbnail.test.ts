import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createVideoThumbnail } from './videoThumbnail'

function mediaPlatform() {
  const video = document.createElement('video')
  const canvas = document.createElement('canvas')
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
    if (tag === 'video') return video
    if (tag === 'canvas') return canvas
    return createElement(tag, options)
  })
  Object.defineProperties(video, {
    videoWidth: { value: 1920 },
    videoHeight: { value: 1080 }
  })
  vi.spyOn(video, 'pause').mockImplementation(() => {})
  vi.spyOn(video, 'load').mockImplementation(() => {})
  vi.spyOn(canvas, 'getContext').mockReturnValue(null)
  return { video, canvas }
}

function mockCanvasDrawing(canvas: HTMLCanvasElement) {
  const drawImage = vi.fn<CanvasRenderingContext2D['drawImage']>()
  Object.defineProperty(canvas, 'getContext', {
    value: () => ({ drawImage }),
    configurable: true
  })
  return drawImage
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:poster')
})

describe('video thumbnail capture platform boundary', () => {
  it('captures a bounded first frame without playback, then releases the decoder', async () => {
    const { video, canvas } = mediaPlatform()
    const drawImage = mockCanvasDrawing(canvas)
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) =>
      callback(new Blob(['frame'], { type: 'image/jpeg' }))
    )
    const result = createVideoThumbnail(
      '/clip.mp4',
      new AbortController().signal
    )
    expect(video.src).toContain('/clip.mp4')
    expect(video.crossOrigin).toBe('anonymous')
    expect(video.muted).toBe(true)
    expect(video.autoplay).toBe(false)
    video.dispatchEvent(new Event('loadeddata'))
    expect(await result).toBe('blob:poster')
    expect(canvas.width).toBe(320)
    expect(canvas.height).toBe(180)
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 320, 180)
    expect(video).not.toHaveAttribute('src')
    expect(video.pause).toHaveBeenCalled()
  })

  it('does not allocate a poster after cancellation during image encoding', async () => {
    const { video, canvas } = mediaPlatform()
    mockCanvasDrawing(canvas)
    let complete!: BlobCallback
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
      complete = callback
    })
    const controller = new AbortController()
    const result = createVideoThumbnail('/clip.mp4', controller.signal)
    video.dispatchEvent(new Event('loadeddata'))
    controller.abort()
    expect(await result).toBeUndefined()
    complete(new Blob(['frame'], { type: 'image/jpeg' }))
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(video).not.toHaveAttribute('src')
  })

  it.for(['error', 'timeout', 'abort', 'canvas-unavailable'] as const)(
    'resolves to a fallback and releases the decoder after %s',
    async (event) => {
      const { video } = mediaPlatform()
      const controller = new AbortController()
      const result = createVideoThumbnail('/clip.mp4', controller.signal)
      if (event === 'error') video.dispatchEvent(new Event('error'))
      if (event === 'abort') controller.abort()
      if (event === 'timeout') vi.advanceTimersByTime(15_000)
      if (event === 'canvas-unavailable')
        video.dispatchEvent(new Event('loadeddata'))
      expect(await result).toBeUndefined()
      expect(video).not.toHaveAttribute('src')
      expect(video.pause).toHaveBeenCalled()
      video.dispatchEvent(new Event('loadeddata'))
      expect(URL.createObjectURL).not.toHaveBeenCalled()
    }
  )
})
