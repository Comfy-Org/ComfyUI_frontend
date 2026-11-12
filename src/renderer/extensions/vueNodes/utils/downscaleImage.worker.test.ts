import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DownscaleRequest,
  DownscaleResponse
} from './downscaleImageMessages'

async function createWorker(width: number, height: number, bytes = 'image') {
  const bitmap = { width, height, close: vi.fn() }
  const canvases: { width: number; height: number }[] = []
  const encoded = new Blob(['display pixels'], { type: 'image/webp' })
  const encode = vi.fn(async () => encoded)
  const complete = vi.fn<(response: DownscaleResponse) => void>()
  const scope: {
    onmessage: ((event: MessageEvent<DownscaleRequest>) => void) | null
    postMessage: (message: DownscaleResponse) => void
  } = { onmessage: null, postMessage: complete }
  vi.stubGlobal('self', scope)
  vi.mocked(fetch).mockImplementation(
    async () => new Response(new Blob([bytes]))
  )
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => bitmap)
  )
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        public width: number,
        public height: number
      ) {
        canvases.push({ width, height })
      }
      getContext() {
        return { imageSmoothingQuality: 'low', drawImage: vi.fn() }
      }
      convertToBlob() {
        return encode()
      }
    }
  )
  await import('./downscaleImage.worker')
  const send = (id: number) =>
    scope.onmessage?.(
      new MessageEvent('message', {
        data: { id, source: `/view?${id}.png`, maxEdge: 1024 }
      })
    )
  return { bitmap, canvases, encoded, encode, send, complete }
}

describe('image downscale worker', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it.for([
    {
      name: 'a landscape still',
      width: 4096,
      height: 2048,
      bytes: 'image',
      mime: 'image/webp',
      sizes: [{ width: 1024, height: 512 }]
    },
    {
      name: 'a portrait still',
      width: 2048,
      height: 4096,
      bytes: 'image',
      mime: 'image/webp',
      sizes: [{ width: 512, height: 1024 }]
    },
    {
      name: 'a small still',
      width: 256,
      height: 128,
      bytes: 'image',
      mime: undefined,
      sizes: []
    },
    {
      name: 'an animation',
      width: 4096,
      height: 2048,
      bytes: 'GIF89a',
      mime: undefined,
      sizes: []
    }
  ])(
    'preserves dimensions and animation for $name',
    async ({ width, height, bytes, sizes, mime }) => {
      const worker = await createWorker(width, height, bytes)

      worker.send(1)
      await vi.waitFor(() => expect(worker.complete).toHaveBeenCalledOnce())
      const message = worker.complete.mock.calls[0][0]

      expect(message).toMatchObject({
        id: 1,
        result: {
          originalSize: { width, height }
        }
      })
      expect(message.result?.blob?.type).toBe(mime)
      expect(worker.canvases).toEqual(sizes)
      expect(worker.bitmap.close).toHaveBeenCalledOnce()
    }
  )

  it('finishes the active encode before decoding the next image', async () => {
    const worker = await createWorker(4096, 2048)
    let finishEncoding = (_blob: Blob): void => {
      throw new Error('Encoding promise was not initialized')
    }
    const encoding = new Promise<Blob>((resolve) => {
      finishEncoding = resolve
    })
    worker.encode.mockReturnValueOnce(encoding)

    worker.send(1)
    worker.send(2)
    await vi.waitFor(() => expect(worker.canvases).toHaveLength(1))
    expect(worker.bitmap.close).not.toHaveBeenCalled()
    finishEncoding(worker.encoded)
    await vi.waitFor(() => expect(worker.bitmap.close).toHaveBeenCalledTimes(2))
    expect(worker.canvases).toHaveLength(2)
  })
})
