import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AssetItem,
  AssetResponse
} from '@/platform/assets/schemas/assetSchema'
import {
  MISSING_TAG,
  assetService
} from '@/platform/assets/services/assetService'
import { api } from '@/scripts/api'

const mockDistributionState = vi.hoisted(() => ({ isCloud: false }))
const mockSettingStoreGet = vi.hoisted(() => vi.fn(() => false))
const mockGetCategoryForNodeType = vi.hoisted(() => vi.fn())

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
      getCategoryForNodeType: mockGetCategoryForNodeType
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

type AssetListResponseOptions = {
  hasMore?: AssetResponse['has_more']
  total?: AssetResponse['total']
  nextCursor?: AssetResponse['next_cursor']
}

function buildResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {}
): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    status: init.status ?? 200
  })
}

function buildAssetListResponse(
  assets: AssetItem[],
  {
    hasMore = false,
    total = assets.length,
    nextCursor
  }: AssetListResponseOptions = {}
): Response {
  return buildResponse({
    assets,
    total,
    has_more: hasMore,
    ...(nextCursor === undefined ? {} : { next_cursor: nextCursor })
  })
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

  it('falls back to the unknown localized message for unrecognized error codes', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse({ code: 'NOT_A_REAL_CODE' }, { ok: false, status: 400 })
    )

    await expect(
      assetService.getAssetMetadata('https://example.com/model.safetensors')
    ).rejects.toThrow('Unknown error')
  })

  it('falls back to unknown when error JSON cannot be parsed', async () => {
    fetchApiMock.mockResolvedValueOnce(
      new Response('not valid json', { status: 400 })
    )

    await expect(
      assetService.getAssetMetadata('https://example.com/model.safetensors')
    ).rejects.toThrow('Unknown error')
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

  it('falls back to unknown when validation errors are absent', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse({
        content_length: 100,
        final_url: 'https://example.com/model.safetensors',
        validation: { is_valid: false }
      })
    )

    await expect(
      assetService.getAssetMetadata('https://example.com/model.safetensors')
    ).rejects.toThrow('Unknown error')
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

describe(assetService.getAssetsForNodeType, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategoryForNodeType.mockReset()
  })

  it('returns an empty list for invalid node types without fetching', async () => {
    await expect(assetService.getAssetsForNodeType('')).resolves.toEqual([])

    expect(fetchApiMock).not.toHaveBeenCalled()
  })

  it('returns an empty list when the node type has no asset category', async () => {
    mockGetCategoryForNodeType.mockReturnValue(undefined)

    await expect(
      assetService.getAssetsForNodeType('UnknownNode')
    ).resolves.toEqual([])

    expect(fetchApiMock).not.toHaveBeenCalled()
  })

  it('fetches category assets with default pagination', async () => {
    mockGetCategoryForNodeType.mockReturnValue('checkpoints')
    const assets = [
      validAsset({ id: 'ckpt-1', tags: ['models', 'checkpoints'] })
    ]
    fetchApiMock.mockResolvedValueOnce(buildAssetListResponse(assets))

    await expect(
      assetService.getAssetsForNodeType('CheckpointLoaderSimple')
    ).resolves.toEqual(assets)

    const requestedUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const params = new URL(requestedUrl, 'http://localhost').searchParams
    expect(params.get('include_tags')).toBe('models,checkpoints')
    expect(params.get('limit')).toBe('500')
    expect(params.has('offset')).toBe(false)
  })

  it('passes positive offsets for category asset pagination', async () => {
    mockGetCategoryForNodeType.mockReturnValue('loras')
    fetchApiMock.mockResolvedValueOnce(buildAssetListResponse([]))

    await assetService.getAssetsForNodeType('LoraLoader', {
      limit: 25,
      offset: 50
    })

    const requestedUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const params = new URL(requestedUrl, 'http://localhost').searchParams
    expect(params.get('include_tags')).toBe('models,loras')
    expect(params.get('limit')).toBe('25')
    expect(params.get('offset')).toBe('50')
  })
})

describe(assetService.getAssetDetails, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when the details response is not ok', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse({}, { ok: false, status: 404 })
    )

    await expect(assetService.getAssetDetails('missing')).rejects.toThrow(
      'Unable to load asset details for missing: Server returned 404'
    )
  })

  it('throws when the details response is invalid', async () => {
    fetchApiMock.mockResolvedValueOnce(buildResponse({ id: 'asset-1' }))

    await expect(assetService.getAssetDetails('asset-1')).rejects.toThrow(
      /Invalid asset response/
    )
  })

  it('returns validated asset details', async () => {
    const asset = validAsset({ id: 'asset-details' })
    fetchApiMock.mockResolvedValueOnce(buildResponse(asset))

    await expect(
      assetService.getAssetDetails('asset-details')
    ).resolves.toEqual(asset)
  })
})

describe(assetService.uploadAssetFromUrl, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assetService.invalidateInputAssetsIncludingPublic()
  })

  it('throws when URL upload returns a non-ok response', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse(null, { ok: false, status: 500 })
    )

    await expect(
      assetService.uploadAssetFromUrl({
        url: 'https://example.com/input.png',
        name: 'input.png'
      })
    ).rejects.toThrow('Failed to upload asset')
  })

  it('does not invalidate cached input assets when the upload response is invalid', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchApiMock
      .mockResolvedValueOnce(buildAssetListResponse(staleAssets))
      .mockResolvedValueOnce(buildResponse({ id: 'missing-name' }))

    await assetService.getInputAssetsIncludingPublic()
    await expect(
      assetService.uploadAssetFromUrl({
        url: 'https://example.com/input.png',
        name: 'input.png',
        tags: ['input']
      })
    ).rejects.toThrow('Failed to upload asset')
    const cached = await assetService.getInputAssetsIncludingPublic()

    expect(cached).toEqual(staleAssets)
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
    consoleSpy.mockRestore()
  })

  it('requires upload responses to include created_new', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchApiMock
      .mockResolvedValueOnce(buildAssetListResponse(staleAssets))
      .mockResolvedValueOnce(
        buildResponse(validAsset({ id: 'uploaded-input', tags: ['input'] }))
      )

    await assetService.getInputAssetsIncludingPublic()
    await expect(
      assetService.uploadAssetFromUrl({
        url: 'https://example.com/input.png',
        name: 'input.png',
        tags: ['input']
      })
    ).rejects.toThrow('Failed to upload asset')
    const cached = await assetService.getInputAssetsIncludingPublic()

    expect(cached).toEqual(staleAssets)
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
    consoleSpy.mockRestore()
  })

  it('returns validated upload responses with created_new', async () => {
    const uploadedAsset = {
      ...validAsset({ id: 'uploaded-input', tags: ['input'] }),
      created_new: true
    }
    fetchApiMock.mockResolvedValueOnce(buildResponse(uploadedAsset))

    await expect(
      assetService.uploadAssetFromUrl({
        url: 'https://example.com/input.png',
        name: 'input.png',
        tags: ['input']
      })
    ).resolves.toEqual(uploadedAsset)
  })
})

describe(assetService.uploadAssetFromBase64, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assetService.invalidateInputAssetsIncludingPublic()
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

  it('throws when base64 upload returns a non-ok response', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('hello'))
    try {
      fetchApiMock.mockResolvedValueOnce(
        buildResponse(null, { ok: false, status: 507 })
      )

      await expect(
        assetService.uploadAssetFromBase64({
          data: 'data:text/plain;base64,aGVsbG8=',
          name: 'input.txt'
        })
      ).rejects.toThrow('Failed to upload asset from base64: 507')
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('posts base64 uploads with tags and user metadata', async () => {
    const uploadedAsset = {
      ...validAsset({ id: 'uploaded-input', tags: ['input'] }),
      created_new: false
    }
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('hello'))
    try {
      fetchApiMock.mockResolvedValueOnce(buildResponse(uploadedAsset))

      const result = await assetService.uploadAssetFromBase64({
        data: 'data:text/plain;base64,aGVsbG8=',
        name: 'input.txt',
        tags: ['input', 'mask'],
        user_metadata: { source: 'paste' }
      })

      expect(result).toEqual(uploadedAsset)
      const request = fetchApiMock.mock.calls[0]?.[1]
      expect(request).toEqual(expect.objectContaining({ method: 'POST' }))
      expect(request?.body).toBeInstanceOf(FormData)
      const formData = request?.body
      if (!(formData instanceof FormData)) {
        throw new Error('Expected base64 upload body to be FormData')
      }
      expect(formData.get('tags')).toBe(JSON.stringify(['input', 'mask']))
      expect(formData.get('user_metadata')).toBe(
        JSON.stringify({ source: 'paste' })
      )
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('does not invalidate cached input assets when the upload response is invalid', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('hello'))
    fetchApiMock
      .mockResolvedValueOnce(buildAssetListResponse(staleAssets))
      .mockResolvedValueOnce(buildResponse({ id: 'missing-name' }))

    await assetService.getInputAssetsIncludingPublic()
    await expect(
      assetService.uploadAssetFromBase64({
        data: 'data:text/plain;base64,aGVsbG8=',
        name: 'input.txt',
        tags: ['input']
      })
    ).rejects.toThrow('Failed to upload asset')
    const cached = await assetService.getInputAssetsIncludingPublic()

    expect(cached).toEqual(staleAssets)
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
    fetchSpy.mockRestore()
    consoleSpy.mockRestore()
  })

  it('rejects upload responses with a non-boolean created_new', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('hello'))
    fetchApiMock
      .mockResolvedValueOnce(buildAssetListResponse(staleAssets))
      .mockResolvedValueOnce(
        buildResponse({
          ...validAsset({ id: 'uploaded-input', tags: ['input'] }),
          created_new: 'true'
        })
      )

    await assetService.getInputAssetsIncludingPublic()
    await expect(
      assetService.uploadAssetFromBase64({
        data: 'data:text/plain;base64,aGVsbG8=',
        name: 'input.txt',
        tags: ['input']
      })
    ).rejects.toThrow('Failed to upload asset')
    const cached = await assetService.getInputAssetsIncludingPublic()

    expect(cached).toEqual(staleAssets)
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
    fetchSpy.mockRestore()
    consoleSpy.mockRestore()
  })
})

describe(assetService.uploadAssetAsync, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assetService.invalidateInputAssetsIncludingPublic()
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

  it('throws when the async upload response is not ok', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse(null, { ok: false, status: 502 })
    )

    await expect(
      assetService.uploadAssetAsync({
        source_url: 'https://example.com/model.safetensors'
      })
    ).rejects.toThrow('Failed to upload asset')
  })

  it('throws when an async upload task response is invalid', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse({ task_id: 'task-1', status: 'waiting' }, { status: 202 })
    )

    await expect(
      assetService.uploadAssetAsync({
        source_url: 'https://example.com/model.safetensors'
      })
    ).rejects.toThrow('Failed to parse async upload response')
  })

  it('throws when a sync upload asset response is invalid', async () => {
    fetchApiMock.mockResolvedValueOnce(buildResponse({ id: 'asset-2' }))

    await expect(
      assetService.uploadAssetAsync({
        source_url: 'https://example.com/model.safetensors'
      })
    ).rejects.toThrow('Failed to parse sync upload response')
  })

  it('invalidates cached input assets for completed async input uploads', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const freshAssets = [validAsset({ id: 'fresh-input', tags: ['input'] })]
    fetchApiMock
      .mockResolvedValueOnce(buildAssetListResponse(staleAssets))
      .mockResolvedValueOnce(
        buildResponse(
          { task_id: 'task-1', status: 'completed' },
          { ok: true, status: 202 }
        )
      )
      .mockResolvedValueOnce(buildAssetListResponse(freshAssets))

    await assetService.getInputAssetsIncludingPublic()
    await assetService.uploadAssetAsync({
      source_url: 'https://example.com/input.png',
      tags: ['input']
    })
    const refreshed = await assetService.getInputAssetsIncludingPublic()

    expect(refreshed).toEqual(freshAssets)
    expect(fetchApiMock).toHaveBeenCalledTimes(3)
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

describe(assetService.addAssetTags, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assetService.invalidateInputAssetsIncludingPublic()
  })

  it('posts tags and returns the parsed tag operation result', async () => {
    const result = { total_tags: ['input', 'mask'], added: ['mask'] }
    fetchApiMock.mockResolvedValueOnce(buildResponse(result))

    await expect(
      assetService.addAssetTags('asset-1', ['mask'])
    ).resolves.toEqual(result)

    expect(fetchApiMock).toHaveBeenCalledWith(
      '/assets/asset-1/tags',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tags: ['mask'] })
      })
    )
  })

  it('throws when adding tags fails', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse(null, { ok: false, status: 403 })
    )

    await expect(
      assetService.addAssetTags('asset-1', ['mask'])
    ).rejects.toThrow(
      'Unable to add tags to asset asset-1: Server returned 403'
    )
  })

  it('throws when the add-tags response is invalid', async () => {
    fetchApiMock.mockResolvedValueOnce(buildResponse({ added: ['mask'] }))

    await expect(
      assetService.addAssetTags('asset-1', ['mask'])
    ).rejects.toThrow()
  })
})

describe(assetService.removeAssetTags, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assetService.invalidateInputAssetsIncludingPublic()
  })

  it('deletes tags and returns the parsed tag operation result', async () => {
    const result = { total_tags: ['input'], removed: ['mask'] }
    fetchApiMock.mockResolvedValueOnce(buildResponse(result))

    await expect(
      assetService.removeAssetTags('asset-1', ['mask'])
    ).resolves.toEqual(result)

    expect(fetchApiMock).toHaveBeenCalledWith(
      '/assets/asset-1/tags',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ tags: ['mask'] })
      })
    )
  })

  it('throws when removing tags fails', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse(null, { ok: false, status: 404 })
    )

    await expect(
      assetService.removeAssetTags('asset-1', ['mask'])
    ).rejects.toThrow(
      'Unable to remove tags from asset asset-1: Server returned 404'
    )
  })

  it('throws when the remove-tags response is invalid', async () => {
    fetchApiMock.mockResolvedValueOnce(buildResponse({ removed: ['mask'] }))

    await expect(
      assetService.removeAssetTags('asset-1', ['mask'])
    ).rejects.toThrow()
  })
})

describe(assetService.getAssetModelFolders, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests missing-tag exclusion and returns alphabetical unique folders without include_public', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildAssetListResponse([
        validAsset({ id: 'a', tags: ['models', 'loras'] }),
        validAsset({ id: 'b', tags: ['models', 'checkpoints'] }),
        validAsset({ id: 'c', tags: ['models', 'configs'] }),
        validAsset({ id: 'e', tags: ['models', 'loras'] })
      ])
    )

    const folders = await assetService.getAssetModelFolders()

    expect(folders).toEqual([
      { name: 'checkpoints', folders: [] },
      { name: 'loras', folders: [] }
    ])

    const requestedUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const params = new URL(requestedUrl, 'http://localhost').searchParams
    expect(params.has('include_public')).toBe(false)
    expect(params.get('exclude_tags')).toBe(MISSING_TAG)
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

  it('throws when the update response is not ok', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse(null, { ok: false, status: 409 })
    )

    await expect(
      assetService.updateAsset('asset-1', { name: 'renamed.safetensors' })
    ).rejects.toThrow('Unable to update asset asset-1: Server returned 409')
  })
})

describe(assetService.getAssetsByTag, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards include_public=true by default and requests missing-tag exclusion', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildAssetListResponse([validAsset({ id: 'visible', tags: ['input'] })])
    )

    const assets = await assetService.getAssetsByTag('input')

    expect(assets.map((a) => a.id)).toEqual(['visible'])

    const requestedUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const params = new URL(requestedUrl, 'http://localhost').searchParams
    expect(params.get('include_public')).toBe('true')
    expect(params.get('exclude_tags')).toBe(MISSING_TAG)
  })

  it('normalizes tag query parameters', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildAssetListResponse([validAsset({ id: 'visible', tags: ['input'] })])
    )

    await assetService.getAssetsByTag(' input ')

    const requestedUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const params = new URL(requestedUrl, 'http://localhost').searchParams
    expect(params.get('include_tags')).toBe('input')
    expect(params.get('exclude_tags')).toBe(MISSING_TAG)
  })

  it('forwards explicit public filtering and offset pagination', async () => {
    fetchApiMock.mockResolvedValueOnce(buildAssetListResponse([]))

    await assetService.getAssetsByTag('input', false, {
      limit: 30,
      offset: 60
    })

    const requestedUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const params = new URL(requestedUrl, 'http://localhost').searchParams
    expect(params.get('include_public')).toBe('false')
    expect(params.get('limit')).toBe('30')
    expect(params.get('offset')).toBe('60')
  })
})

describe(assetService.getAllAssetsByTag, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('walks pages by keyset cursor with include_public=true', async () => {
    fetchApiMock
      .mockResolvedValueOnce(
        buildAssetListResponse(
          [
            validAsset({ id: 'a', tags: ['input'] }),
            validAsset({ id: 'b', tags: ['input'] })
          ],
          { hasMore: true, nextCursor: 'cursor-page-2' }
        )
      )
      .mockResolvedValueOnce(
        buildAssetListResponse([validAsset({ id: 'c', tags: ['input'] })])
      )

    const assets = await assetService.getAllAssetsByTag('input', true, {
      limit: 2
    })

    expect(assets.map((a) => a.id)).toEqual(['a', 'b', 'c'])

    const firstUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const firstParams = new URL(firstUrl, 'http://localhost').searchParams
    expect(firstParams.get('include_public')).toBe('true')
    expect(firstParams.get('exclude_tags')).toBe(MISSING_TAG)
    expect(firstParams.get('limit')).toBe('2')
    // First page carries neither a cursor nor an offset.
    expect(firstParams.has('after')).toBe(false)
    expect(firstParams.has('offset')).toBe(false)

    const secondUrl = fetchApiMock.mock.calls[1]?.[0] as string
    const secondParams = new URL(secondUrl, 'http://localhost').searchParams
    expect(secondParams.get('include_public')).toBe('true')
    expect(secondParams.get('exclude_tags')).toBe(MISSING_TAG)
    expect(secondParams.get('limit')).toBe('2')
    // Subsequent pages resume from the prior response's next_cursor, never offset.
    expect(secondParams.get('after')).toBe('cursor-page-2')
    expect(secondParams.has('offset')).toBe(false)
  })

  it('uses the default page size when limit is not positive', async () => {
    fetchApiMock.mockResolvedValueOnce(buildAssetListResponse([]))

    await expect(
      assetService.getAllAssetsByTag('input', true, { limit: 0 })
    ).resolves.toEqual([])

    const requestedUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const params = new URL(requestedUrl, 'http://localhost').searchParams
    expect(params.get('limit')).toBe('500')
  })

  it('throws before fetching when the pagination signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      assetService.getAllAssetsByTag('input', true, {
        signal: controller.signal
      })
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(fetchApiMock).not.toHaveBeenCalled()
  })

  it('honors has_more when walking tagged asset pages', async () => {
    fetchApiMock
      .mockResolvedValueOnce(
        buildAssetListResponse(
          [
            validAsset({ id: 'first', tags: ['input'] }),
            validAsset({ id: 'second', tags: ['input'] })
          ],
          { hasMore: true, nextCursor: 'cursor-next' }
        )
      )
      .mockResolvedValueOnce(
        buildAssetListResponse([
          validAsset({ id: 'later-public', tags: ['input'] })
        ])
      )

    const assets = await assetService.getAllAssetsByTag('input', true, {
      limit: 3
    })

    expect(assets.map((a) => a.id)).toEqual(['first', 'second', 'later-public'])
    expect(fetchApiMock).toHaveBeenCalledTimes(2)

    const secondUrl = fetchApiMock.mock.calls[1]?.[0]
    if (typeof secondUrl !== 'string') {
      throw new Error('Expected a second asset request URL')
    }
    const secondParams = new URL(secondUrl, 'http://localhost').searchParams
    expect(secondParams.get('after')).toBe('cursor-next')
  })

  it('stops walking when next_cursor is absent even if has_more is true', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildAssetListResponse([validAsset({ id: 'only', tags: ['input'] })], {
        hasMore: true
      })
    )

    const assets = await assetService.getAllAssetsByTag('input', true, {
      limit: 2
    })

    expect(assets.map((a) => a.id)).toEqual(['only'])
    expect(fetchApiMock).toHaveBeenCalledOnce()
  })

  it('stops walking when the server returns a non-advancing cursor', async () => {
    fetchApiMock
      .mockResolvedValueOnce(
        buildAssetListResponse([validAsset({ id: 'a', tags: ['input'] })], {
          hasMore: true,
          nextCursor: 'stuck'
        })
      )
      .mockResolvedValueOnce(
        buildAssetListResponse([validAsset({ id: 'b', tags: ['input'] })], {
          hasMore: true,
          nextCursor: 'stuck'
        })
      )

    const assets = await assetService.getAllAssetsByTag('input', true, {
      limit: 1
    })

    expect(assets.map((a) => a.id)).toEqual(['a', 'b'])
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
  })

  it.for([
    {
      name: 'missing has_more',
      body: {
        assets: [validAsset({ id: 'a', tags: ['input'] })],
        total: 1
      }
    },
    {
      name: 'missing total',
      body: {
        assets: [validAsset({ id: 'a', tags: ['input'] })],
        has_more: false
      }
    },
    {
      name: 'non-boolean has_more',
      body: {
        assets: [validAsset({ id: 'a', tags: ['input'] })],
        total: 1,
        has_more: 'false'
      }
    }
  ])('rejects asset responses with $name', async ({ body }) => {
    fetchApiMock.mockResolvedValueOnce(buildResponse(body))

    await expect(
      assetService.getAllAssetsByTag('input', true, { limit: 2 })
    ).rejects.toThrow(/Invalid asset response/)
  })

  it('passes abort signals through paginated requests', async () => {
    const controller = new AbortController()
    fetchApiMock.mockResolvedValueOnce(
      buildAssetListResponse([validAsset({ id: 'a', tags: ['input'] })])
    )

    await assetService.getAllAssetsByTag('input', true, {
      limit: 2,
      signal: controller.signal
    })

    expect(fetchApiMock).toHaveBeenCalledWith(expect.any(String), {
      signal: controller.signal
    })
  })

  it('stops pagination when aborted between pages', async () => {
    const controller = new AbortController()
    fetchApiMock.mockImplementationOnce(async () => {
      controller.abort()
      return buildAssetListResponse(
        [
          validAsset({ id: 'a', tags: ['input'] }),
          validAsset({ id: 'b', tags: ['input'] })
        ],
        { hasMore: true, nextCursor: 'cursor-page-2' }
      )
    })

    await expect(
      assetService.getAllAssetsByTag('input', true, {
        limit: 2,
        signal: controller.signal
      })
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(fetchApiMock).toHaveBeenCalledOnce()
  })
})

describe(assetService.createAssetExport, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts export options and returns the export task', async () => {
    const task = { task_id: 'export-1', status: 'created', message: 'queued' }
    fetchApiMock.mockResolvedValueOnce(buildResponse(task))

    await expect(
      assetService.createAssetExport({
        asset_ids: ['asset-1'],
        include_previews: true
      })
    ).resolves.toEqual(task)

    expect(fetchApiMock).toHaveBeenCalledWith(
      '/assets/export',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          asset_ids: ['asset-1'],
          include_previews: true
        })
      })
    )
  })

  it('throws when creating an export fails', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse(null, { ok: false, status: 503 })
    )

    await expect(
      assetService.createAssetExport({ asset_ids: ['asset-1'] })
    ).rejects.toThrow('Failed to create asset export: 503')
  })
})

describe(assetService.getExportDownloadUrl, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the export download URL', async () => {
    const download = {
      url: 'https://example.com/export.zip',
      expires_at: '2026-07-01T00:00:00Z'
    }
    fetchApiMock.mockResolvedValueOnce(buildResponse(download))

    await expect(
      assetService.getExportDownloadUrl('export.zip')
    ).resolves.toEqual(download)

    expect(fetchApiMock).toHaveBeenCalledWith('/assets/exports/export.zip')
  })

  it('throws when export download URL lookup fails', async () => {
    fetchApiMock.mockResolvedValueOnce(
      buildResponse(null, { ok: false, status: 404 })
    )

    await expect(
      assetService.getExportDownloadUrl('missing.zip')
    ).rejects.toThrow('Failed to get export download URL: 404')
  })
})

describe(assetService.getInputAssetsIncludingPublic, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assetService.invalidateInputAssetsIncludingPublic()
  })

  it('loads input assets with public assets included and reuses the cache', async () => {
    const assets = [
      validAsset({ id: 'user-input', tags: ['input'] }),
      validAsset({ id: 'public-input', tags: ['input'], is_immutable: true })
    ]
    fetchApiMock.mockResolvedValueOnce(buildAssetListResponse(assets))

    const first = await assetService.getInputAssetsIncludingPublic()
    const second = await assetService.getInputAssetsIncludingPublic()

    expect(first).toEqual(assets)
    expect(second).toBe(first)
    expect(fetchApiMock).toHaveBeenCalledOnce()

    const requestedUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const params = new URL(requestedUrl, 'http://localhost').searchParams
    expect(params.get('include_public')).toBe('true')
    expect(params.get('limit')).toBe('500')
  })

  it('throws before starting a shared request when the caller signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      assetService.getInputAssetsIncludingPublic(controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(fetchApiMock).not.toHaveBeenCalled()
  })

  it('fetches fresh input assets after explicit invalidation', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const freshAssets = [validAsset({ id: 'fresh-input', tags: ['input'] })]
    fetchApiMock
      .mockResolvedValueOnce(buildAssetListResponse(staleAssets))
      .mockResolvedValueOnce(buildAssetListResponse(freshAssets))

    await assetService.getInputAssetsIncludingPublic()
    assetService.invalidateInputAssetsIncludingPublic()
    const refreshed = await assetService.getInputAssetsIncludingPublic()

    expect(refreshed).toEqual(freshAssets)
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
  })

  it('does not let one caller abort the shared input asset load for other callers', async () => {
    const firstController = new AbortController()
    const secondController = new AbortController()
    const assets = [validAsset({ id: 'public-input', tags: ['input'] })]
    let resolveResponse!: (response: Response) => void
    let serviceSignal: AbortSignal | undefined
    fetchApiMock.mockImplementationOnce(async (_url, options) => {
      serviceSignal = options?.signal ?? undefined
      return await new Promise<Response>((resolve) => {
        resolveResponse = resolve
      })
    })

    const first = assetService.getInputAssetsIncludingPublic(
      firstController.signal
    )
    const second = assetService.getInputAssetsIncludingPublic(
      secondController.signal
    )
    firstController.abort()

    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    expect(serviceSignal).toBeUndefined()

    resolveResponse(buildAssetListResponse(assets))

    await expect(second).resolves.toEqual(assets)
    expect(fetchApiMock).toHaveBeenCalledOnce()
  })

  it('keeps the shared input asset load alive after all callers abort', async () => {
    const firstController = new AbortController()
    const secondController = new AbortController()
    const assets = [validAsset({ id: 'public-input', tags: ['input'] })]
    let resolveResponse!: (response: Response) => void
    fetchApiMock.mockImplementationOnce(
      async () =>
        await new Promise<Response>((resolve) => {
          resolveResponse = resolve
        })
    )

    const first = assetService.getInputAssetsIncludingPublic(
      firstController.signal
    )
    const second = assetService.getInputAssetsIncludingPublic(
      secondController.signal
    )
    firstController.abort()
    secondController.abort()

    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await expect(second).rejects.toMatchObject({ name: 'AbortError' })

    resolveResponse(buildAssetListResponse(assets))
    await Promise.resolve()

    await expect(assetService.getInputAssetsIncludingPublic()).resolves.toEqual(
      assets
    )
    expect(fetchApiMock).toHaveBeenCalledOnce()
  })

  it('does not abort in-flight input asset loads when invalidated', async () => {
    const assets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const freshAssets = [validAsset({ id: 'fresh-input', tags: ['input'] })]
    let resolveResponse!: (response: Response) => void
    fetchApiMock
      .mockImplementationOnce(
        async () =>
          await new Promise<Response>((resolve) => {
            resolveResponse = resolve
          })
      )
      .mockResolvedValueOnce(buildAssetListResponse(freshAssets))

    const inFlight = assetService.getInputAssetsIncludingPublic()
    assetService.invalidateInputAssetsIncludingPublic()

    resolveResponse(buildAssetListResponse(assets))

    await expect(inFlight).resolves.toEqual(assets)
    await expect(assetService.getInputAssetsIncludingPublic()).resolves.toEqual(
      freshAssets
    )
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
  })

  it('invalidates cached input assets after deleting an asset', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const freshAssets = [validAsset({ id: 'fresh-input', tags: ['input'] })]
    fetchApiMock
      .mockResolvedValueOnce(buildAssetListResponse(staleAssets))
      .mockResolvedValueOnce(buildResponse(null))
      .mockResolvedValueOnce(buildAssetListResponse(freshAssets))

    await assetService.getInputAssetsIncludingPublic()
    await assetService.deleteAsset('stale-input')
    const refreshed = await assetService.getInputAssetsIncludingPublic()

    expect(refreshed).toEqual(freshAssets)
    expect(fetchApiMock).toHaveBeenCalledTimes(3)
    expect(fetchApiMock.mock.calls[1]).toEqual([
      '/assets/stale-input',
      expect.objectContaining({ method: 'DELETE' })
    ])
  })

  it('invalidates cached input assets after an input asset upload', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const uploadedAsset = validAsset({ id: 'uploaded-input', tags: ['input'] })
    const freshAssets = [uploadedAsset]
    fetchApiMock
      .mockResolvedValueOnce(buildAssetListResponse(staleAssets))
      .mockResolvedValueOnce(buildResponse(uploadedAsset))
      .mockResolvedValueOnce(buildAssetListResponse(freshAssets))

    await assetService.getInputAssetsIncludingPublic()
    await assetService.uploadAssetAsync({
      source_url: 'https://example.com/input.png',
      tags: ['input']
    })
    const refreshed = await assetService.getInputAssetsIncludingPublic()

    expect(refreshed).toEqual(freshAssets)
    expect(fetchApiMock).toHaveBeenCalledTimes(3)
  })

  it('does not invalidate cached input assets for pending async input uploads', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    fetchApiMock
      .mockResolvedValueOnce(buildAssetListResponse(staleAssets))
      .mockResolvedValueOnce(
        buildResponse(
          { task_id: 'task-1', status: 'running' },
          { ok: true, status: 202 }
        )
      )

    await assetService.getInputAssetsIncludingPublic()
    await assetService.uploadAssetAsync({
      source_url: 'https://example.com/input.png',
      tags: ['input']
    })
    const cached = await assetService.getInputAssetsIncludingPublic()

    expect(cached).toEqual(staleAssets)
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
  })

  it('does not invalidate cached input assets for non-input uploads', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    fetchApiMock
      .mockResolvedValueOnce(buildAssetListResponse(staleAssets))
      .mockResolvedValueOnce(buildResponse(validAsset({ tags: ['models'] })))

    await assetService.getInputAssetsIncludingPublic()
    await assetService.uploadAssetAsync({
      source_url: 'https://example.com/model.safetensors',
      tags: ['models']
    })
    const cached = await assetService.getInputAssetsIncludingPublic()

    expect(cached).toEqual(staleAssets)
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
  })
})
