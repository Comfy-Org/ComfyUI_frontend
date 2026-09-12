import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { uploadMedia } from '@/platform/assets/services/uploadService'
import { useToastStore } from '@/platform/updates/common/toastStore'

vi.mock('@/platform/assets/services/uploadService', () => ({
  uploadMedia: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    getRandParam: () => '?rand=123'
  }
}))

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

describe('Load3dUtils.uploadFile', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  it('returns the uploaded path on success', async () => {
    vi.mocked(uploadMedia).mockResolvedValue({
      success: true,
      path: 'subfolder/file.png',
      name: 'file.png',
      subfolder: 'subfolder',
      response: { name: 'file.png', subfolder: 'subfolder' }
    })

    const file = new File(['x'], 'file.png')
    const result = await Load3dUtils.uploadFile(file, 'subfolder')

    expect(result).toBe('subfolder/file.png')
    expect(uploadMedia).toHaveBeenCalledWith(
      { source: file },
      { subfolder: 'subfolder', maxSizeMB: Load3dUtils.MAX_UPLOAD_SIZE_MB }
    )
  })

  it('shows file-too-large toast when size exceeds maximum', async () => {
    vi.mocked(uploadMedia).mockResolvedValue({
      success: false,
      path: '',
      name: '',
      subfolder: '',
      error: 'File size 200MB exceeds maximum 100MB',
      response: null
    })

    const file = new File(['x'], 'big.png')
    Object.defineProperty(file, 'size', {
      value: 200 * 1024 * 1024,
      writable: false
    })

    const result = await Load3dUtils.uploadFile(file, '3d')

    expect(result).toBeUndefined()
    const toastStore = useToastStore()
    expect(toastStore.addAlert).toHaveBeenCalledOnce()
  })

  it('shows generic alert toast on other upload failures', async () => {
    vi.mocked(uploadMedia).mockResolvedValue({
      success: false,
      path: '',
      name: '',
      subfolder: '',
      error: 'Network error',
      response: null
    })

    const result = await Load3dUtils.uploadFile(
      new File(['x'], 'fail.png'),
      '3d'
    )

    expect(result).toBeUndefined()
    const toastStore = useToastStore()
    expect(toastStore.addAlert).toHaveBeenCalledWith('Network error')
  })
})

describe('Load3dUtils.uploadTempImage', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  it('returns the upload response on success', async () => {
    const response = { name: 'thumb_123.png', subfolder: 'threed' }
    vi.mocked(uploadMedia).mockResolvedValue({
      success: true,
      path: 'threed/thumb_123.png',
      name: 'thumb_123.png',
      subfolder: 'threed',
      response
    })

    const result = await Load3dUtils.uploadTempImage(
      'data:image/png;base64,abc',
      'thumb'
    )

    expect(result).toEqual(response)
    expect(uploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'data:image/png;base64,abc' }),
      { subfolder: 'threed', type: 'temp' }
    )
  })

  it('throws and shows alert on failure', async () => {
    vi.mocked(uploadMedia).mockResolvedValue({
      success: false,
      path: '',
      name: '',
      subfolder: '',
      error: 'boom',
      response: null
    })

    await expect(
      Load3dUtils.uploadTempImage('data:image/png;base64,abc', 'thumb')
    ).rejects.toThrow()

    const toastStore = useToastStore()
    expect(toastStore.addAlert).toHaveBeenCalledOnce()
  })
})

describe('Load3dUtils.uploadMultipleFiles', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  it('filters out failed uploads', async () => {
    vi.mocked(uploadMedia)
      .mockResolvedValueOnce({
        success: true,
        path: '3d/a.png',
        name: 'a.png',
        subfolder: '3d',
        response: { name: 'a.png' }
      })
      .mockResolvedValueOnce({
        success: false,
        path: '',
        name: '',
        subfolder: '',
        error: 'failed',
        response: null
      })

    const files = [new File(['1'], 'a.png'), new File(['2'], 'b.png')]
    const fileList = {
      length: files.length,
      item: (i: number) => files[i] ?? null,
      [Symbol.iterator]: function* () {
        for (const f of files) yield f
      }
    } as unknown as FileList

    const results = await Load3dUtils.uploadMultipleFiles(fileList)

    expect(results).toEqual(['3d/a.png'])
  })
})
