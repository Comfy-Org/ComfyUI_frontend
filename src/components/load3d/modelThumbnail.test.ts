import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateModelThumbnail } from './modelThumbnail'

const isAssetPreviewSupported = vi.hoisted(() => vi.fn(() => false))
const persistThumbnail = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@/platform/assets/utils/assetPreviewUtil', () => ({
  isAssetPreviewSupported,
  persistThumbnail
}))

const createLoad3d = vi.hoisted(() => vi.fn())
vi.mock('@/extensions/core/load3d/createLoad3d', () => ({ createLoad3d }))

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
})
