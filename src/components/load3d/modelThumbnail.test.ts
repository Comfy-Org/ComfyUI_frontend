import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateModelThumbnail } from './modelThumbnail'

const isAssetPreviewSupported = vi.hoisted(() => vi.fn(() => false))
const persistThumbnail = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@/platform/assets/utils/assetPreviewUtil', () => ({
  isAssetPreviewSupported,
  persistThumbnail
}))

const reportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({ reportError }))

const createLoad3d = vi.hoisted(() => vi.fn())
vi.mock('@/extensions/core/load3d/createLoad3d', () => ({ createLoad3d }))

function mockInstance(overrides: Record<string, unknown> = {}) {
  const invalidate = vi.fn()
  return {
    loadModel: vi.fn().mockResolvedValue(undefined),
    captureThumbnail: vi.fn().mockResolvedValue('data:image/png;base64,thumb'),
    remove: vi.fn(),
    getLoaderManager: vi.fn(() => ({ invalidate })),
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

    expect(result).toBe('data:image/png;base64,thumb')
    expect(instance.loadModel).toHaveBeenCalledWith('/api/view?filename=a.glb')
    expect(instance.remove).toHaveBeenCalledTimes(1)
    expect(persistThumbnail).not.toHaveBeenCalled()
  })

  it('persists the thumbnail when the asset API is available', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob()) })
    )
    createLoad3d.mockReturnValue(mockInstance())

    await generateModelThumbnail('/a.glb', 'a.glb')

    await vi.waitFor(() =>
      expect(persistThumbnail).toHaveBeenCalledWith('a.glb', expect.any(Blob))
    )
  })

  it('returns null and still disposes when the model fails to load', async () => {
    const instance = mockInstance({
      loadModel: vi.fn().mockRejectedValue(new Error('bad model'))
    })
    createLoad3d.mockReturnValue(instance)

    const result = await generateModelThumbnail('/broken.glb', 'broken.glb')

    expect(result).toBeNull()
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

  it('times out a stuck load, disposes it, and advances the queue', async () => {
    vi.useFakeTimers()
    const stuck = mockInstance({
      loadModel: vi.fn(() => new Promise<void>(() => {}))
    })
    const next = mockInstance()
    createLoad3d.mockReturnValueOnce(stuck).mockReturnValueOnce(next)

    const stuckRun = generateModelThumbnail('/stuck.glb', 'stuck.glb')
    const nextRun = generateModelThumbnail('/next.glb', 'next.glb')
    await vi.waitFor(() => expect(createLoad3d).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(15_000)

    await expect(stuckRun).resolves.toBeNull()
    await expect(nextRun).resolves.toBe('data:image/png;base64,thumb')
    expect(stuck.remove).toHaveBeenCalledTimes(1)
    expect(next.loadModel).toHaveBeenCalledWith('/next.glb')
    expect(reportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorType: 'load3d_thumbnail_generation_failed'
      })
    )
  })

  it('invalidates the loader before disposing on timeout, so a load that resolves afterward cannot publish', async () => {
    vi.useFakeTimers()
    const invalidate = vi.fn()
    const order: string[] = []
    const stuck = mockInstance({
      loadModel: vi.fn(() => new Promise<void>(() => {})),
      remove: vi.fn(() => order.push('remove')),
      getLoaderManager: vi.fn(() => ({
        invalidate: () => {
          order.push('invalidate')
          invalidate()
        }
      })),
      captureThumbnail: vi.fn(() => {
        // Would only run if the abandoned load were (incorrectly) awaited
        // past the timeout; asserting it never fires is the regression
        // check for the resource leak this fix closes.
        throw new Error('must not capture a thumbnail for an invalidated load')
      })
    })
    createLoad3d.mockReturnValueOnce(stuck)

    const stuckRun = generateModelThumbnail('/stuck.glb', 'stuck.glb')
    await vi.waitFor(() => expect(createLoad3d).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(15_000)

    await expect(stuckRun).resolves.toBeNull()
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(stuck.remove).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['invalidate', 'remove'])
    expect(stuck.captureThumbnail).not.toHaveBeenCalled()
  })
})
