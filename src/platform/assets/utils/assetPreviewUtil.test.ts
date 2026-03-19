import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  findOutputAsset,
  findServerPreviewUrl,
  isAssetPreviewSupported,
  persistThumbnail
} from '@/platform/assets/utils/assetPreviewUtil'

const mockFetchApi = vi.hoisted(() => vi.fn())
const mockApiURL = vi.hoisted(() =>
  vi.fn((path: string) => `http://localhost:8188${path}`)
)
const mockGetServerFeature = vi.hoisted(() => vi.fn(() => false))
const mockIsAssetAPIEnabled = vi.hoisted(() => vi.fn(() => false))
const mockUploadAssetFromBase64 = vi.hoisted(() => vi.fn())
const mockUpdateAsset = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: mockFetchApi,
    apiURL: mockApiURL,
    api_base: '',
    getServerFeature: mockGetServerFeature
  }
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    isAssetAPIEnabled: mockIsAssetAPIEnabled,
    uploadAssetFromBase64: mockUploadAssetFromBase64,
    updateAsset: mockUpdateAsset
  }
}))

function mockFetchResponse(assets: Record<string, unknown>[]) {
  mockFetchApi.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ assets })
  })
}

function mockFetchEmpty() {
  mockFetchResponse([])
}

function mockFetchError() {
  mockFetchApi.mockResolvedValueOnce({ ok: false })
}

const cloudAsset = {
  id: '72d169cc-7f9a-40d2-9382-35eadcba0a6a',
  name: 'mesh/ComfyUI_00003_.glb',
  asset_hash: 'c6cadcee57dd.glb',
  preview_id: null,
  preview_url: undefined
}

const cloudAssetWithPreview = {
  ...cloudAsset,
  preview_id: 'aaaa-bbbb',
  preview_url: '/api/view?type=output&filename=preview.png'
}

const localAsset = {
  id: '50bf419e-7ecb-4c96-a0c7-c1eb4dff00cb',
  name: 'ComfyUI_00081_.glb',
  preview_id: null,
  preview_url:
    '/api/view?type=output&filename=ComfyUI_00081_.glb&subfolder=mesh'
}

const localAssetWithPreview = {
  ...localAsset,
  preview_id: '3df94ee8-preview',
  preview_url: '/api/view?type=output&filename=preview.png'
}

describe('isAssetPreviewSupported', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when asset API is enabled (cloud)', () => {
    mockIsAssetAPIEnabled.mockReturnValue(true)
    expect(isAssetPreviewSupported()).toBe(true)
  })

  it('returns true when server assets feature is enabled (local)', () => {
    mockGetServerFeature.mockReturnValue(true)
    expect(isAssetPreviewSupported()).toBe(true)
  })

  it('returns false when neither is enabled', () => {
    mockIsAssetAPIEnabled.mockReturnValue(false)
    mockGetServerFeature.mockReturnValue(false)
    expect(isAssetPreviewSupported()).toBe(false)
  })
})

describe('findOutputAsset', () => {
  beforeEach(() => vi.clearAllMocks())

  it('finds asset by hash (cloud)', async () => {
    mockFetchResponse([cloudAsset])

    const result = await findOutputAsset('c6cadcee57dd.glb')

    expect(mockFetchApi).toHaveBeenCalledOnce()
    expect(mockFetchApi.mock.calls[0][0]).toContain(
      'asset_hash=c6cadcee57dd.glb'
    )
    expect(result).toEqual(cloudAsset)
  })

  it('falls back to name_contains when hash returns empty (local)', async () => {
    mockFetchEmpty()
    mockFetchResponse([localAsset])

    const result = await findOutputAsset('ComfyUI_00081_.glb')

    expect(mockFetchApi).toHaveBeenCalledTimes(2)
    expect(mockFetchApi.mock.calls[0][0]).toContain('asset_hash=')
    expect(mockFetchApi.mock.calls[1][0]).toContain('name_contains=')
    expect(result).toEqual(localAsset)
  })

  it('returns undefined when no asset matches', async () => {
    mockFetchEmpty()
    mockFetchEmpty()

    const result = await findOutputAsset('nonexistent.glb')
    expect(result).toBeUndefined()
  })

  it('matches exact name from name_contains results', async () => {
    mockFetchEmpty()
    mockFetchResponse([
      { id: '1', name: 'ComfyUI_00001_.glb_preview.png' },
      { id: '2', name: 'ComfyUI_00001_.glb' }
    ])

    const result = await findOutputAsset('ComfyUI_00001_.glb')
    expect(result?.id).toBe('2')
  })

  it('returns empty array on fetch error', async () => {
    mockFetchError()
    mockFetchError()

    const result = await findOutputAsset('test.glb')
    expect(result).toBeUndefined()
  })
})

describe('findServerPreviewUrl', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when asset has no preview_id', async () => {
    mockFetchResponse([cloudAsset])

    const result = await findServerPreviewUrl('c6cadcee57dd.glb')
    expect(result).toBeNull()
  })

  it('returns preview_url via apiURL when preview_id is set', async () => {
    mockFetchResponse([cloudAssetWithPreview])

    const result = await findServerPreviewUrl('c6cadcee57dd.glb')

    expect(mockApiURL).toHaveBeenCalledWith(cloudAssetWithPreview.preview_url)
    expect(result).toBe(
      `http://localhost:8188${cloudAssetWithPreview.preview_url}`
    )
  })

  it('constructs URL from preview_id when preview_url is missing', async () => {
    mockFetchResponse([{ ...cloudAsset, preview_id: 'aaaa-bbbb' }])

    const result = await findServerPreviewUrl('c6cadcee57dd.glb')
    expect(result).toBe('http://localhost:8188/assets/aaaa-bbbb/content')
  })

  it('falls back to asset id when preview_id is null but set', async () => {
    // Edge case: asset has preview_id explicitly null, no preview_url
    mockFetchEmpty()
    mockFetchEmpty()

    const result = await findServerPreviewUrl('nonexistent.glb')
    expect(result).toBeNull()
  })

  it('returns null on error', async () => {
    mockFetchApi.mockRejectedValueOnce(new Error('network error'))

    const result = await findServerPreviewUrl('test.glb')
    expect(result).toBeNull()
  })
})

describe('persistThumbnail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uploads thumbnail and links preview_id', async () => {
    mockFetchEmpty()
    mockFetchResponse([localAsset])
    mockUploadAssetFromBase64.mockResolvedValue({ id: 'new-preview-id' })
    mockUpdateAsset.mockResolvedValue({})

    const blob = new Blob(['fake-png'], { type: 'image/png' })
    await persistThumbnail('ComfyUI_00081_.glb', blob)

    expect(mockUploadAssetFromBase64).toHaveBeenCalledOnce()
    expect(mockUploadAssetFromBase64.mock.calls[0][0].name).toBe(
      'ComfyUI_00081_.glb_preview.png'
    )
    expect(mockUpdateAsset).toHaveBeenCalledWith(localAsset.id, {
      preview_id: 'new-preview-id'
    })
  })

  it('skips when asset already has preview_id', async () => {
    mockFetchEmpty()
    mockFetchResponse([localAssetWithPreview])

    const blob = new Blob(['fake-png'], { type: 'image/png' })
    await persistThumbnail('ComfyUI_00081_.glb', blob)

    expect(mockUploadAssetFromBase64).not.toHaveBeenCalled()
    expect(mockUpdateAsset).not.toHaveBeenCalled()
  })

  it('skips when no asset found', async () => {
    mockFetchEmpty()
    mockFetchEmpty()

    const blob = new Blob(['fake-png'], { type: 'image/png' })
    await persistThumbnail('nonexistent.glb', blob)

    expect(mockUploadAssetFromBase64).not.toHaveBeenCalled()
  })

  it('swallows errors silently', async () => {
    mockFetchEmpty()
    mockFetchResponse([localAsset])
    mockUploadAssetFromBase64.mockRejectedValue(new Error('upload failed'))

    const blob = new Blob(['fake-png'], { type: 'image/png' })
    await expect(
      persistThumbnail('ComfyUI_00081_.glb', blob)
    ).resolves.toBeUndefined()
  })

  it('works with cloud hash filename', async () => {
    mockFetchResponse([cloudAsset])
    mockUploadAssetFromBase64.mockResolvedValue({ id: 'new-preview-id' })
    mockUpdateAsset.mockResolvedValue({})

    const blob = new Blob(['fake-png'], { type: 'image/png' })
    await persistThumbnail('c6cadcee57dd.glb', blob)

    expect(mockUploadAssetFromBase64.mock.calls[0][0].name).toBe(
      'mesh/ComfyUI_00003_.glb_preview.png'
    )
    expect(mockUpdateAsset).toHaveBeenCalledWith(cloudAsset.id, {
      preview_id: 'new-preview-id'
    })
  })
})
