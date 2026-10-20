import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_MODEL_CAPABILITIES, fetchModelData } from './ModelAdapter'
import type { Load3dHost } from './interfaces'

describe('DEFAULT_MODEL_CAPABILITIES', () => {
  it('enables fit-to-viewer / gizmo / lighting / export by default', () => {
    expect(DEFAULT_MODEL_CAPABILITIES.fitToViewer).toBe(true)
    expect(DEFAULT_MODEL_CAPABILITIES.requiresMaterialRebuild).toBe(false)
    expect(DEFAULT_MODEL_CAPABILITIES.gizmoTransform).toBe(true)
    expect(DEFAULT_MODEL_CAPABILITIES.lighting).toBe(true)
    expect(DEFAULT_MODEL_CAPABILITIES.exportable).toBe(true)
    expect([...DEFAULT_MODEL_CAPABILITIES.materialModes]).toEqual([
      'original',
      'clay',
      'normal',
      'wireframe'
    ])
  })
})

describe('fetchModelData', () => {
  const fetchApi = vi.fn<Load3dHost['fetchApi']>()

  it('returns the arrayBuffer on a successful response', async () => {
    fetchApi.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    )

    const result = await fetchModelData(
      fetchApi,
      'api/view?...&filename=',
      'model.glb'
    )

    expect([...new Uint8Array(result)]).toEqual([1, 2, 3])
  })

  it('throws with status code when the response is not ok', async () => {
    fetchApi.mockResolvedValue(new Response(null, { status: 404 }))

    await expect(
      fetchModelData(
        fetchApi,
        'api/view?type=input&subfolder=&filename=',
        'missing.glb'
      )
    ).rejects.toThrow('Failed to fetch model: 404')
  })

  it('strips the leading api/ prefix and encodes the filename', async () => {
    fetchApi.mockResolvedValue(new Response(new ArrayBuffer(0)))

    await fetchModelData(
      fetchApi,
      'api/view?type=input&subfolder=&filename=',
      'a b c.ply'
    )

    expect(fetchApi.mock.calls[0][0]).toBe(
      '/view?type=input&subfolder=&filename=a%20b%20c.ply'
    )
  })

  it('prepends a single slash when the path has no api/ prefix', async () => {
    fetchApi.mockResolvedValue(new Response(new ArrayBuffer(0)))

    await fetchModelData(fetchApi, 'custom?filename=', 'scene.splat')

    expect(fetchApi.mock.calls[0][0]).toBe('/custom?filename=scene.splat')
  })

  it('forwards cancellation to the model request', async () => {
    const controller = new AbortController()
    fetchApi.mockResolvedValue(
      new Response(new ArrayBuffer(0), { status: 200 })
    )

    await fetchModelData(
      fetchApi,
      'api/view?filename=',
      'model.glb',
      controller.signal
    )

    expect(fetchApi).toHaveBeenCalledWith('/view?filename=model.glb', {
      signal: controller.signal
    })
  })
})
