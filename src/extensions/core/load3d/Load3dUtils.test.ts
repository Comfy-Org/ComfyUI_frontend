import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { api } from '@/scripts/api'

vi.mock(import('@/scripts/api'))

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

describe('Load3dUtils upload failures', () => {
  const serverError = () =>
    new Response(null, { status: 500, statusText: 'Internal Server Error' })

  it('warns with a localized title when the model upload is rejected', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(serverError())

    await expect(
      Load3dUtils.uploadFile(new File(['x'], 'mesh.glb'), '3d')
    ).resolves.toBeUndefined()

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: 'Upload failed: 500 - Internal Server Error'
      })
    ])
  })

  it('warns with a localized title when the model upload throws', async () => {
    vi.mocked(api.fetchApi).mockRejectedValue(new Error('Network Error'))

    await expect(
      Load3dUtils.uploadFile(new File(['x'], 'mesh.glb'), '3d')
    ).resolves.toBeUndefined()

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: 'Upload failed: Network Error'
      })
    ])
  })

  it('warns with a localized title and throws when the temp image upload is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob()) })
    )
    vi.mocked(api.fetchApi).mockResolvedValue(serverError())

    await expect(
      Load3dUtils.uploadTempImage('data:image/png;base64,', 'scene')
    ).rejects.toThrow('Error uploading temp file: 500 - Internal Server Error')

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: 'Upload failed: 500 - Internal Server Error'
      })
    ])
  })
})
