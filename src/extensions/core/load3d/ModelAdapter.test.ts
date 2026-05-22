import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { DEFAULT_MODEL_CAPABILITIES, fetchModelData } from './ModelAdapter'

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn()
  }
}))

describe('DEFAULT_MODEL_CAPABILITIES', () => {
  it('enables fit-to-viewer / gizmo / lighting / export by default', () => {
    expect(DEFAULT_MODEL_CAPABILITIES.fitToViewer).toBe(true)
    expect(DEFAULT_MODEL_CAPABILITIES.requiresMaterialRebuild).toBe(false)
    expect(DEFAULT_MODEL_CAPABILITIES.gizmoTransform).toBe(true)
    expect(DEFAULT_MODEL_CAPABILITIES.lighting).toBe(true)
    expect(DEFAULT_MODEL_CAPABILITIES.exportable).toBe(true)
    expect([...DEFAULT_MODEL_CAPABILITIES.materialModes]).toEqual([
      'original',
      'normal',
      'wireframe'
    ])
  })
})

describe('fetchModelData', () => {
  const mockFetchApi = vi.mocked(api.fetchApi)

  beforeEach(() => {
    mockFetchApi.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the arrayBuffer on a successful response', async () => {
    const buf = new ArrayBuffer(8)
    mockFetchApi.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: vi.fn().mockResolvedValue(buf)
    } as unknown as Response)

    const result = await fetchModelData('api/view?...&filename=', 'model.glb')

    expect(result).toBe(buf)
  })

  it('throws with status code when the response is not ok', async () => {
    mockFetchApi.mockResolvedValue({
      ok: false,
      status: 404
    } as unknown as Response)

    await expect(
      fetchModelData('api/view?type=input&subfolder=&filename=', 'missing.glb')
    ).rejects.toThrow('Failed to fetch model: 404')
  })

  it('strips the leading api/ prefix and encodes the filename', async () => {
    mockFetchApi.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
    } as unknown as Response)

    await fetchModelData(
      'api/view?type=input&subfolder=&filename=',
      'a b c.ply'
    )

    expect(mockFetchApi).toHaveBeenCalledWith(
      '/view?type=input&subfolder=&filename=a%20b%20c.ply'
    )
  })

  it('prepends a single slash when the path has no api/ prefix', async () => {
    mockFetchApi.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
    } as unknown as Response)

    await fetchModelData('custom?filename=', 'scene.splat')

    expect(mockFetchApi).toHaveBeenCalledWith('/custom?filename=scene.splat')
  })
})
