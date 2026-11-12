import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DownscaleRequest,
  DownscaleResponse
} from './downscaleImageMessages'

type WorkerBehavior = (worker: FakeWorker, request: DownscaleRequest) => void

let behavior: WorkerBehavior

class FakeWorker {
  onmessage: ((event: MessageEvent<DownscaleResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminate = vi.fn()
  postMessage(request: DownscaleRequest) {
    queueMicrotask(() => behavior(this, request))
  }
}

function respond(
  worker: FakeWorker,
  request: DownscaleRequest,
  result: DownscaleResponse['result']
) {
  worker.onmessage?.(
    new MessageEvent('message', { data: { id: request.id, result } })
  )
}

async function loadModule() {
  vi.resetModules()
  return import('./downscaledImage')
}

describe('getDisplayImage', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('createImageBitmap', vi.fn())
    vi.stubGlobal('OffscreenCanvas', class {})
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `blob:copy-${Math.random()}`
    )
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('falls back to the original when a worker fails to load', async () => {
    behavior = (worker) => worker.onerror?.(new ErrorEvent('error'))
    const { getDisplayImage } = await loadModule()

    await expect(getDisplayImage('/view?a.png', 1024)).resolves.toEqual({
      source: '/view?a.png',
      url: '/view?a.png'
    })
    await expect(getDisplayImage('/view?b.png', 1024)).resolves.toEqual({
      source: '/view?b.png',
      url: '/view?b.png'
    })
  })

  it('shows in-memory blob sources as they are without a worker round trip', async () => {
    const postMessage = vi.spyOn(FakeWorker.prototype, 'postMessage')
    const { getDisplayImage } = await loadModule()

    await expect(getDisplayImage('blob:live-preview', 1024)).resolves.toEqual({
      source: 'blob:live-preview',
      url: 'blob:live-preview'
    })
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('revokes only the copies it created when evicting', async () => {
    behavior = (worker, request) =>
      respond(worker, request, {
        originalSize: { width: 10, height: 10 },
        blob: request.source.includes('small') ? undefined : new Blob()
      })
    const { getDisplayImage } = await loadModule()

    const borrowed = await getDisplayImage('/view?small-original.png', 1024)
    const created = await getDisplayImage('/view?large.png', 1024)
    for (let i = 0; i < 128; i++) await getDisplayImage(`/view?${i}.png`, 1024)

    expect(borrowed.url).toBe('/view?small-original.png')
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(
      '/view?small-original.png'
    )
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(created.url)
  })
})
