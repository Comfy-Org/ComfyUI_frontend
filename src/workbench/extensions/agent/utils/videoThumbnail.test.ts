import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMockCanvasRenderingContext2D,
  createTestCanvasElement
} from '@/utils/__tests__/canvasTestUtils'

import { createVideoThumbnail } from './videoThumbnail'

function mediaPlatform(canvas = document.createElement('canvas')) {
  const video = document.createElement('video')
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'video') return video
    if (tag === 'canvas') return canvas
    return createElement(tag)
  })
  Object.defineProperties(video, {
    videoWidth: { value: 1920 },
    videoHeight: { value: 1080 }
  })
  vi.spyOn(video, 'pause').mockImplementation(() => {})
  vi.spyOn(video, 'load').mockImplementation(() => {})
  return { video, canvas }
}

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:poster')
})

describe('video thumbnail capture platform boundary', () => {
  it('captures a bounded first frame without playback, then releases the decoder', async () => {
    const context = createMockCanvasRenderingContext2D({ drawImage: vi.fn() })
    const { video, canvas } = mediaPlatform(
      createTestCanvasElement({ ctx: context })
    )
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
    expect(context.drawImage).toHaveBeenCalledWith(video, 0, 0, 320, 180)
    expect(video).not.toHaveAttribute('src')
    expect(video.pause).toHaveBeenCalled()
  })

  it('does not allocate a poster after cancellation during image encoding', async () => {
    const { video, canvas } = mediaPlatform(
      createTestCanvasElement({
        ctx: createMockCanvasRenderingContext2D({ drawImage: vi.fn() })
      })
    )
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

  it.for([
    {
      event: 'a decoding error',
      act: (video: HTMLVideoElement) => video.dispatchEvent(new Event('error'))
    },
    {
      event: 'a timeout',
      act: () => vi.advanceTimersByTime(15_000)
    },
    {
      event: 'cancellation',
      act: (_video: HTMLVideoElement, controller: AbortController) =>
        controller.abort()
    },
    {
      event: 'an unavailable canvas context',
      act: (video: HTMLVideoElement) =>
        video.dispatchEvent(new Event('loadeddata'))
    }
  ])(
    'resolves to a fallback and releases the decoder after $event',
    async ({ act }) => {
      const { video } = mediaPlatform()
      const controller = new AbortController()
      const result = createVideoThumbnail('/clip.mp4', controller.signal)
      act(video, controller)
      expect(await result).toBeUndefined()
      expect(video).not.toHaveAttribute('src')
      expect(video.pause).toHaveBeenCalled()
      video.dispatchEvent(new Event('loadeddata'))
      expect(URL.createObjectURL).not.toHaveBeenCalled()
    }
  )
})
