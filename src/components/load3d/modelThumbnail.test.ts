import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateModelThumbnail } from './modelThumbnail'

const createLoad3d = vi.hoisted(() => vi.fn())
vi.mock('@/extensions/core/load3d/createLoad3d', () => ({ createLoad3d }))

const isAssetPreviewSupported = vi.hoisted(() => vi.fn(() => false))
const persistThumbnail = vi.hoisted(() =>
  vi.fn(async (_assetName: string, _blob: Blob) => {})
)
vi.mock('@/platform/assets/utils/assetPreviewUtil', () => ({
  isAssetPreviewSupported,
  persistThumbnail
}))

const reportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({ reportError }))

function mockInstance(overrides: Record<string, unknown> = {}) {
  return {
    loadModel: vi.fn().mockResolvedValue(undefined),
    captureThumbnail: vi.fn().mockResolvedValue('data:image/png;base64,thumb'),
    remove: vi.fn(),
    ...overrides
  }
}

describe('generateModelThumbnail', () => {
  beforeEach(() => {
    createLoad3d.mockReset()
    isAssetPreviewSupported.mockReset().mockReturnValue(false)
    persistThumbnail.mockReset()
    reportError.mockReset()
  })

  it('renders offscreen, returns the data url, and disposes the instance', async () => {
    const instance = mockInstance()
    createLoad3d.mockReturnValue(instance)

    const result = await generateModelThumbnail(
      '/api/view?filename=a.glb',
      'a.glb'
    )

    expect(result).toEqual({
      status: 'rendered',
      dataUrl: 'data:image/png;base64,thumb'
    })
    expect(instance.loadModel).toHaveBeenCalledWith(
      '/api/view?filename=a.glb',
      undefined,
      { silent: true }
    )
    expect(instance.remove).toHaveBeenCalledTimes(1)
    expect(persistThumbnail).not.toHaveBeenCalled()
  })

  it('releases the queue the moment a running render is aborted', async () => {
    vi.useFakeTimers()
    try {
      const stalled = mockInstance({
        loadModel: vi.fn(() => new Promise(() => {}))
      })
      const next = mockInstance()
      createLoad3d.mockReturnValueOnce(stalled).mockReturnValueOnce(next)
      const controller = new AbortController()

      const abortedRun = generateModelThumbnail(
        '/slow.glb',
        'slow.glb',
        controller.signal
      )
      const nextRun = generateModelThumbnail('/next.glb', 'next.glb')
      await vi.advanceTimersByTimeAsync(0)
      expect(createLoad3d).toHaveBeenCalledTimes(1)

      controller.abort()
      await vi.advanceTimersByTimeAsync(0)

      await expect(abortedRun).resolves.toEqual({ status: 'cancelled' })
      await expect(nextRun).resolves.toEqual({
        status: 'rendered',
        dataUrl: 'data:image/png;base64,thumb'
      })
      expect(stalled.remove).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
      expect(reportError).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips a queued render whose caller aborted before its turn', async () => {
    const blocked = mockInstance({
      loadModel: vi.fn(() => new Promise(() => {}))
    })
    const skipped = mockInstance()
    createLoad3d.mockReturnValueOnce(blocked).mockReturnValueOnce(skipped)
    const controller = new AbortController()

    vi.useFakeTimers()
    try {
      const blockedRun = generateModelThumbnail('/stuck.glb', 'stuck.glb')
      const skippedRun = generateModelThumbnail(
        '/next.glb',
        'next.glb',
        controller.signal
      )
      controller.abort()
      await vi.advanceTimersByTimeAsync(10_000)

      await expect(blockedRun).resolves.toEqual({ status: 'timed-out' })
      await expect(skippedRun).resolves.toEqual({ status: 'cancelled' })
      expect(createLoad3d).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a failed render and still disposes the instance', async () => {
    const instance = mockInstance({
      loadModel: vi.fn().mockRejectedValue(new Error('bad model'))
    })
    createLoad3d.mockReturnValue(instance)

    const result = await generateModelThumbnail('/broken.glb', 'broken.glb')

    expect(result).toEqual({ status: 'failed' })
    expect(instance.remove).toHaveBeenCalledTimes(1)
  })

  it('runs generations one at a time', async () => {
    let releaseFirst!: () => void
    const first = mockInstance({
      loadModel: vi.fn(
        () => new Promise<void>((resolve) => (releaseFirst = resolve))
      )
    })
    const second = mockInstance()
    createLoad3d.mockReturnValueOnce(first).mockReturnValueOnce(second)

    const firstRun = generateModelThumbnail('/one.glb', 'one.glb')
    const secondRun = generateModelThumbnail('/two.glb', 'two.glb')
    await vi.waitFor(() => expect(createLoad3d).toHaveBeenCalledTimes(1))

    releaseFirst()
    await firstRun
    await secondRun

    expect(createLoad3d).toHaveBeenCalledTimes(2)
  })

  it('cancels a stuck load, disposes it, and advances the queue', async () => {
    vi.useFakeTimers()
    try {
      const first = mockInstance({
        loadModel: vi.fn(() => new Promise(() => {}))
      })
      const second = mockInstance()
      createLoad3d.mockReturnValueOnce(first).mockReturnValueOnce(second)

      const firstRun = generateModelThumbnail('/stuck.glb', 'stuck.glb')
      const secondRun = generateModelThumbnail('/next.glb', 'next.glb')
      await vi.advanceTimersByTimeAsync(10_000)

      await expect(firstRun).resolves.toEqual({ status: 'timed-out' })
      await expect(secondRun).resolves.toEqual({
        status: 'rendered',
        dataUrl: 'data:image/png;base64,thumb'
      })
      expect(first.remove).toHaveBeenCalledOnce()
      expect(second.remove).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Model thumbnail generation timed out'
        }),
        { errorType: 'agent_model_thumbnail_generation_failure' }
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('bounds thumbnail capture and clears the timeout after success', async () => {
    vi.useFakeTimers()
    try {
      const first = mockInstance({
        captureThumbnail: vi.fn(() => new Promise(() => {}))
      })
      const second = mockInstance()
      createLoad3d.mockReturnValueOnce(first).mockReturnValueOnce(second)

      const firstRun = generateModelThumbnail('/stuck.glb', 'stuck.glb')
      const secondRun = generateModelThumbnail('/next.glb', 'next.glb')
      await vi.advanceTimersByTimeAsync(10_000)

      await expect(firstRun).resolves.toEqual({ status: 'timed-out' })
      await expect(secondRun).resolves.toEqual({
        status: 'rendered',
        dataUrl: 'data:image/png;base64,thumb'
      })
      expect(first.remove).toHaveBeenCalledOnce()
      expect(second.remove).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('persists a supported asset thumbnail after rendering', async () => {
    const instance = mockInstance()
    createLoad3d.mockReturnValue(instance)
    isAssetPreviewSupported.mockReturnValue(true)
    const blob = new Blob(['thumbnail'], { type: 'image/png' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(blob))

    await generateModelThumbnail('/model.glb', 'model.glb')
    await vi.waitFor(() => expect(persistThumbnail).toHaveBeenCalledOnce())

    const [assetName, persistedBlob] = persistThumbnail.mock.calls[0]
    expect(assetName).toBe('model.glb')
    expect(persistedBlob).toBeInstanceOf(Blob)
    expect(persistedBlob.type).toBe('image/png')
    await expect(persistedBlob.text()).resolves.toBe('thumbnail')
  })
})
