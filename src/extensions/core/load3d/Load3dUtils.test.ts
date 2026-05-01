import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'

const { fetchApiMock } = vi.hoisted(() => ({
  fetchApiMock: vi.fn()
}))

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: fetchApiMock
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    getRandParam: () => '&rand=1'
  }
}))

describe('Load3dUtils.resourceExists', () => {
  beforeEach(() => {
    fetchApiMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when the HEAD probe is ok', async () => {
    fetchApiMock.mockResolvedValueOnce({ ok: true })

    const exists = await Load3dUtils.resourceExists('sub/model.glb', 'output')

    expect(exists).toBe(true)
    expect(fetchApiMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchApiMock.mock.calls[0]
    expect(options).toEqual({ method: 'HEAD' })
    expect(url).toContain('filename=model.glb')
    expect(url).toContain('subfolder=sub')
    expect(url).toContain('type=output')
  })

  it('returns false when the HEAD probe is a 404', async () => {
    fetchApiMock.mockResolvedValueOnce({ ok: false, status: 404 })

    const exists = await Load3dUtils.resourceExists(
      'missing/model.glb',
      'output'
    )

    expect(exists).toBe(false)
  })

  it('returns false when fetchApi throws', async () => {
    fetchApiMock.mockRejectedValueOnce(new Error('network down'))

    const exists = await Load3dUtils.resourceExists('any/model.glb', 'output')

    expect(exists).toBe(false)
  })

  it('handles paths with no subfolder', async () => {
    fetchApiMock.mockResolvedValueOnce({ ok: true })

    await Load3dUtils.resourceExists('model.glb', 'input')

    const [url] = fetchApiMock.mock.calls[0]
    expect(url).toContain('filename=model.glb')
    expect(url).toContain('subfolder=')
    expect(url).toContain('type=input')
  })
})

describe('Load3dUtils.mapSceneLightIntensityToHdri', () => {
  it('maps scene slider low end to a small positive HDRI intensity', () => {
    expect(Load3dUtils.mapSceneLightIntensityToHdri(1, 1, 10)).toBe(0.25)
    expect(Load3dUtils.mapSceneLightIntensityToHdri(10, 1, 10)).toBe(5)
  })

  it('maps midpoint proportionally', () => {
    expect(Load3dUtils.mapSceneLightIntensityToHdri(5.5, 1, 10)).toBeCloseTo(
      2.5
    )
  })

  it('clamps scene ratio and HDRI ceiling', () => {
    expect(Load3dUtils.mapSceneLightIntensityToHdri(-10, 1, 10)).toBe(0.25)
    expect(Load3dUtils.mapSceneLightIntensityToHdri(100, 1, 10)).toBe(5)
  })

  it('uses minimum HDRI when span is zero', () => {
    expect(Load3dUtils.mapSceneLightIntensityToHdri(3, 5, 5)).toBe(0.25)
  })
})
