import { beforeEach, describe, expect, it, vi } from 'vitest'

import { assetService } from '@/platform/assets/services/assetService'
import { api } from '@/scripts/api'

const mockDistributionState = vi.hoisted(() => ({ isCloud: false }))
const mockSettingStoreGet = vi.hoisted(() => vi.fn(() => false))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockDistributionState.isCloud
  }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: mockSettingStoreGet
  }))
}))

vi.mock('@/stores/modelToNodeStore', () => {
  const registeredNodeTypes: Record<string, string> = {
    CheckpointLoaderSimple: 'ckpt_name',
    LoraLoader: 'lora_name'
  }
  return {
    useModelToNodeStore: vi.fn(() => ({
      getRegisteredNodeTypes: () => registeredNodeTypes,
      getCategoryForNodeType: vi.fn()
    }))
  }
})

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn()
  }
}))

vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

describe(assetService.shouldUseAssetBrowser, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDistributionState.isCloud = false
    mockSettingStoreGet.mockReturnValue(false)
  })

  it('returns false when not on cloud', () => {
    mockDistributionState.isCloud = false
    mockSettingStoreGet.mockReturnValue(true)

    expect(
      assetService.shouldUseAssetBrowser('CheckpointLoaderSimple', 'ckpt_name')
    ).toBe(false)
  })

  it('returns false when asset API setting is disabled', () => {
    mockDistributionState.isCloud = true
    mockSettingStoreGet.mockReturnValue(false)

    expect(
      assetService.shouldUseAssetBrowser('CheckpointLoaderSimple', 'ckpt_name')
    ).toBe(false)
  })

  it('returns false when node type is not eligible', () => {
    mockDistributionState.isCloud = true
    mockSettingStoreGet.mockReturnValue(true)

    expect(
      assetService.shouldUseAssetBrowser('UnknownNode', 'some_input')
    ).toBe(false)
  })

  it('returns true when cloud, setting enabled, and node is eligible', () => {
    mockDistributionState.isCloud = true
    mockSettingStoreGet.mockReturnValue(true)

    expect(
      assetService.shouldUseAssetBrowser('CheckpointLoaderSimple', 'ckpt_name')
    ).toBe(true)
  })

  it('returns false when nodeType is undefined', () => {
    mockDistributionState.isCloud = true
    mockSettingStoreGet.mockReturnValue(true)

    expect(assetService.shouldUseAssetBrowser(undefined, 'ckpt_name')).toBe(
      false
    )
  })

  it('returns false when widget name does not match registered input', () => {
    mockDistributionState.isCloud = true
    mockSettingStoreGet.mockReturnValue(true)

    expect(
      assetService.shouldUseAssetBrowser(
        'CheckpointLoaderSimple',
        'wrong_input'
      )
    ).toBe(false)
  })
})

describe(assetService.getAssetsByJobIds, () => {
  const mockFetchApi = vi.mocked(api.fetchApi)

  function mockFetchApiResponse(assets: Record<string, unknown>[]) {
    mockFetchApi.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ assets })
    } as unknown as Response)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array for empty jobIds', async () => {
    const result = await assetService.getAssetsByJobIds([])

    expect(result).toEqual([])
    expect(mockFetchApi).not.toHaveBeenCalled()
  })

  it('constructs URL with job_ids query param', async () => {
    mockFetchApiResponse([])

    await assetService.getAssetsByJobIds(['job-1', 'job-2'])

    const url = mockFetchApi.mock.calls[0][0] as string
    expect(url).toContain('job_ids=job-1%2Cjob-2')
  })

  it('includes offset when greater than 0', async () => {
    mockFetchApiResponse([])

    await assetService.getAssetsByJobIds(['job-1'], { offset: 10 })

    const url = mockFetchApi.mock.calls[0][0] as string
    expect(url).toContain('offset=10')
  })

  it('omits offset when 0', async () => {
    mockFetchApiResponse([])

    await assetService.getAssetsByJobIds(['job-1'], { offset: 0 })

    const url = mockFetchApi.mock.calls[0][0] as string
    expect(url).not.toContain('offset')
  })

  it('throws on non-OK response', async () => {
    mockFetchApi.mockResolvedValueOnce({
      ok: false,
      status: 500
    } as unknown as Response)

    await expect(assetService.getAssetsByJobIds(['job-1'])).rejects.toThrow(
      'Server returned 500'
    )
  })

  it('returns parsed assets from response', async () => {
    const assets = [
      { id: 'a1', name: 'img.png', tags: ['output'] },
      { id: 'a2', name: 'img2.png', tags: ['output'] }
    ]
    mockFetchApiResponse(assets)

    const result = await assetService.getAssetsByJobIds(['job-1'])

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('a1')
    expect(result[1].id).toBe('a2')
  })
})
