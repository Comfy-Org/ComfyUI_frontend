// @vitest-environment happy-dom
import { render, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { useFrameScrub } from './useFrameScrub'

const gsapMocks = vi.hoisted(() => ({
  context: vi.fn((callback: () => void) => {
    callback()
    return { revert: vi.fn() }
  }),
  to: vi.fn()
}))

vi.mock('../scripts/gsapSetup', () => ({
  gsap: gsapMocks
}))

vi.mock('./useReducedMotion', () => ({
  prefersReducedMotion: () => false
}))

function renderFrameScrub(canvas: HTMLCanvasElement, urls: string[]) {
  return render(
    defineComponent({
      setup() {
        useFrameScrub(ref(canvas), {
          urls,
          scrollTrigger: () => ({})
        })
        return () => null
      }
    })
  )
}

function stubCanvas(canvas: HTMLCanvasElement) {
  Object.defineProperties(canvas, {
    clientWidth: { value: 208 },
    clientHeight: { value: 208 }
  })
  const draw = {
    clearRect: vi.fn(),
    drawImage: vi.fn()
  } as unknown as CanvasRenderingContext2D
  vi.spyOn(canvas, 'getContext').mockReturnValue(draw)
  return draw
}

describe('useFrameScrub', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 3)
  })

  it('decodes frames at the rendered canvas size and releases them', async () => {
    const canvas = document.createElement('canvas')
    const draw = stubCanvas(canvas)
    const bitmaps = [
      { width: 416, height: 416, close: vi.fn() },
      { width: 416, height: 416, close: vi.fn() }
    ] as unknown as ImageBitmap[]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['frame']), { status: 200 }))
    )
    const createImageBitmapMock = vi
      .fn<typeof createImageBitmap>()
      .mockResolvedValueOnce(bitmaps[0])
      .mockResolvedValueOnce(bitmaps[1])
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)

    const { unmount } = renderFrameScrub(canvas, ['frame-1', 'frame-2'])

    await waitFor(() => expect(createImageBitmapMock).toHaveBeenCalledTimes(2))

    expect(createImageBitmapMock).toHaveBeenCalledWith(expect.any(Blob), {
      resizeWidth: 416,
      resizeHeight: 416,
      resizeQuality: 'high'
    })
    expect(canvas.width).toBe(416)
    expect(canvas.height).toBe(416)
    expect(draw.drawImage).toHaveBeenCalledWith(bitmaps[0], 0, 0, 416, 416)

    unmount()
    expect(bitmaps[0].close).toHaveBeenCalledOnce()
    expect(bitmaps[1].close).toHaveBeenCalledOnce()
  })

  it('bounds concurrent frame loads and aborts them on unmount', async () => {
    const canvas = document.createElement('canvas')
    stubCanvas(canvas)
    let requestSignal: AbortSignal | undefined
    const fetchMock = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init?.signal ?? undefined
          requestSignal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('createImageBitmap', vi.fn())

    const { unmount } = renderFrameScrub(
      canvas,
      Array.from({ length: 6 }, (_, index) => `frame-${index}`)
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    unmount()

    expect(requestSignal?.aborted).toBe(true)
  })
})
