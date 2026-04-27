import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
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

const fetchApiMock = vi.mocked(api.fetchApi)

function buildResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {}
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response
}

function validAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-1',
    name: 'model.safetensors',
    tags: ['models'],
    ...overrides
  }
}

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

describe(assetService.getAssetMetadata, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws a localized message when the response is not ok', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse({ code: 'FILE_TOO_LARGE' }, { ok: false, status: 413 })
    )

    await expect(
      assetService.getAssetMetadata('https://example.com/model.safetensors')
    ).rejects.toThrow('File too large')
  })

  it('throws a localized message when validation reports is_valid=false', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse({
        content_length: 100,
        final_url: 'https://example.com/model.safetensors',
        validation: {
          is_valid: false,
          errors: [{ code: 'UNSAFE_VIRUS_SCAN', message: 'bad', field: 'file' }]
        }
      })
    )

    await expect(
      assetService.getAssetMetadata('https://example.com/model.safetensors')
    ).rejects.toThrow('Unsafe virus scan')
  })

  it('encodes the URL in the query string', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse({
        content_length: 1,
        final_url: 'https://example.com/x'
      })
    )

    await assetService.getAssetMetadata('https://example.com/foo bar?x=1')

    expect(fetchApiMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/assets/remote-metadata?url=' +
          encodeURIComponent('https://example.com/foo bar?x=1')
      )
    )
  })
})

describe(assetService.uploadAssetFromBase64, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws before calling the network when data is not a data URL', async () => {
    await expect(
      assetService.uploadAssetFromBase64({
        data: 'not-a-data-url',
        name: 'image.png'
      })
    ).rejects.toThrow('Invalid data URL')

    expect(fetchApiMock).not.toHaveBeenCalled()
  })
})

describe(assetService.uploadAssetAsync, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an async result when the server responds 202', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse(
        { task_id: 'task-1', status: 'running' },
        { ok: true, status: 202 }
      )
    )

    const result = await assetService.uploadAssetAsync({
      source_url: 'https://example.com/model.safetensors'
    })

    expect(result).toEqual({
      type: 'async',
      task: { task_id: 'task-1', status: 'running' }
    })
  })

  it('returns a sync result when the server responds 200', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse(validAsset({ id: 'asset-2', name: 'sync.safetensors' }))
    )

    const result = await assetService.uploadAssetAsync({
      source_url: 'https://example.com/model.safetensors'
    })

    expect(result).toEqual({
      type: 'sync',
      asset: expect.objectContaining({ id: 'asset-2' })
    })
  })
})

describe(assetService.deleteAsset, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws an error containing the status code when the response is not ok', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse(null, { ok: false, status: 503 })
    )

    await expect(assetService.deleteAsset('asset-1')).rejects.toThrow(/503/)
  })

  it('issues a DELETE to the asset endpoint when the response is ok', async () => {
    fetchApiMock.mockResolvedValueOnce(buildResponse(null))

    await assetService.deleteAsset('asset-1')

    expect(fetchApiMock).toHaveBeenCalledWith(
      '/assets/asset-1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})

describe(assetService.getAssetModelFolders, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters out missing-tagged assets and blacklisted directories, returning alphabetical unique folders without include_public', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse({
        assets: [
          validAsset({ id: 'a', tags: ['models', 'loras'] }),
          validAsset({ id: 'b', tags: ['models', 'checkpoints'] }),
          validAsset({ id: 'c', tags: ['models', 'configs'] }),
          validAsset({ id: 'd', tags: ['models', 'missing', 'controlnet'] }),
          validAsset({ id: 'e', tags: ['models', 'loras'] })
        ]
      })
    )

    const folders = await assetService.getAssetModelFolders()

    expect(folders).toEqual([
      { name: 'checkpoints', folders: [] },
      { name: 'loras', folders: [] }
    ])

    const requestedUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const params = new URL(requestedUrl, 'http://localhost').searchParams
    expect(params.has('include_public')).toBe(false)
  })
})

describe(assetService.updateAsset, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when the response body fails schema validation', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse({ name: 'no-id-field.safetensors' })
    )

    await expect(
      assetService.updateAsset('asset-1', { name: 'renamed.safetensors' })
    ).rejects.toThrow(/Invalid response/)
  })

  it('PUTs the JSON payload and returns the parsed asset', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse(validAsset({ id: 'asset-1', name: 'renamed.safetensors' }))
    )

    const result = await assetService.updateAsset('asset-1', {
      name: 'renamed.safetensors'
    })

    expect(result).toEqual(
      expect.objectContaining({ id: 'asset-1', name: 'renamed.safetensors' })
    )
    expect(fetchApiMock).toHaveBeenCalledWith(
      '/assets/asset-1',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'renamed.safetensors' })
      })
    )
  })
})

describe(assetService.getAssetsByTag, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards include_public=true by default and excludes missing-tagged assets', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse({
        assets: [
          validAsset({ id: 'visible', tags: ['input'] }),
          validAsset({ id: 'hidden', tags: ['input', 'missing'] })
        ]
      })
    )

    const assets = await assetService.getAssetsByTag('input')

    expect(assets.map((a) => a.id)).toEqual(['visible'])

    const requestedUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const params = new URL(requestedUrl, 'http://localhost').searchParams
    expect(params.get('include_public')).toBe('true')
  })
})
