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
  })

  it('falls back to the original when a worker fails to load', async () => {
    behavior = (worker) => worker.onerror?.(new ErrorEvent('error'))
    const { getDisplayImage } = await loadModule()

    await expect(
      Promise.all([
        getDisplayImage('/view?a.png', 1024),
        getDisplayImage('/view?b.png', 1024)
      ])
    ).resolves.toEqual([{ source: '/view?a.png' }, { source: '/view?b.png' }])
    await expect(getDisplayImage('/view?later.png', 1024)).resolves.toEqual({
      source: '/view?later.png'
    })
  })

  it('shows in-memory blob sources as they are without a worker round trip', async () => {
    const postMessage = vi.spyOn(FakeWorker.prototype, 'postMessage')
    const { getDisplayImage } = await loadModule()

    await expect(getDisplayImage('blob:live-preview', 1024)).resolves.toEqual({
      source: 'blob:live-preview'
    })
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('keeps returned copies usable when a burst exceeds cache capacity', async () => {
    const copy = new Blob(['display pixels'])
    behavior = (worker, request) =>
      respond(worker, request, {
        originalSize: { width: 4096, height: 2048 },
        blob: copy
      })
    const { getDisplayImage } = await loadModule()

    const results = await Promise.all(
      Array.from({ length: 256 }, (_, i) =>
        getDisplayImage(`/view?${i}.png`, 1024)
      )
    )

    expect(results[0]).toEqual({
      source: '/view?0.png',
      blob: copy,
      originalSize: { width: 4096, height: 2048 }
    })
    await expect(results[0].blob?.text()).resolves.toBe('display pixels')
  })

  it('reuses pending and completed copies of the same source', async () => {
    const requests: { worker: FakeWorker; request: DownscaleRequest }[] = []
    behavior = (worker, request) => requests.push({ worker, request })
    const { getDisplayImage } = await loadModule()

    const first = getDisplayImage('/view?shared.png', 1024)
    const second = getDisplayImage('/view?shared.png', 1024)
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    const copy = new Blob(['shared copy'])
    respond(requests[0].worker, requests[0].request, {
      blob: copy,
      originalSize: { width: 4096, height: 2048 }
    })

    const results = await Promise.all([first, second])
    expect(results[0]).toEqual(results[1])
    expect(results[0].blob).toBe(copy)
    await expect(getDisplayImage('/view?shared.png', 1024)).resolves.toEqual(
      results[0]
    )
    expect(requests).toHaveLength(1)
  })

  it('keeps a replacement cached when an evicted older request fails', async () => {
    const requests: { worker: FakeWorker; request: DownscaleRequest }[] = []
    behavior = (worker, request) => requests.push({ worker, request })
    const { getDisplayImage } = await loadModule()

    const old = getDisplayImage('/view?replacement.png', 1024)
    const pressure = Array.from({ length: 256 }, (_, i) =>
      getDisplayImage(`/view?${i}.png`, 1024)
    )
    const replacement = getDisplayImage('/view?replacement.png', 1024)
    await vi.waitFor(() => expect(requests).toHaveLength(258))
    respond(requests[0].worker, requests[0].request, undefined)
    requests
      .slice(1, -1)
      .forEach(({ worker, request }) => respond(worker, request, undefined))
    const latest = requests[257]
    const copy = new Blob(['replacement pixels'])
    respond(latest.worker, latest.request, {
      blob: copy,
      originalSize: { width: 4096, height: 2048 }
    })
    await Promise.all([old, ...pressure])
    const image = await replacement

    await expect(
      getDisplayImage('/view?replacement.png', 1024)
    ).resolves.toEqual(image)
    expect(image.blob).toBe(copy)
    expect(requests).toHaveLength(258)
  })

  it('cleans up a partially created pool and falls back on later requests', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
    const created: FakeWorker[] = []
    vi.stubGlobal(
      'Worker',
      class extends FakeWorker {
        constructor() {
          super()
          if (created.length === 1) throw new DOMException('Worker unavailable')
          created.push(this)
        }
      }
    )
    const { getDisplayImage } = await loadModule()

    await expect(getDisplayImage('/view?a.png', 1024)).resolves.toEqual({
      source: '/view?a.png'
    })
    await expect(getDisplayImage('/view?b.png', 1024)).resolves.toEqual({
      source: '/view?b.png'
    })
    expect(created).toHaveLength(1)
    expect(created[0].terminate).toHaveBeenCalledOnce()
  })
})
