import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  MISSING_TAG,
  assetService,
  isBlake3AssetHash,
  toBlake3AssetHash
} from '@/platform/assets/services/assetService'
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

const validBlake3Hash =
  '1111111111111111111111111111111111111111111111111111111111111111'
const validBlake3AssetHash = `blake3:${validBlake3Hash}`

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

describe(isBlake3AssetHash, () => {
  it('accepts only prefixed 64-character blake3 hashes', () => {
    expect(isBlake3AssetHash(validBlake3AssetHash)).toBe(true)
    expect(isBlake3AssetHash('BLAKE3:' + validBlake3Hash.toUpperCase())).toBe(
      true
    )
    expect(isBlake3AssetHash('blake3:abc')).toBe(false)
    expect(isBlake3AssetHash(validBlake3Hash)).toBe(false)
  })
})

describe(toBlake3AssetHash, () => {
  it('normalizes 64-character blake3 hex values to asset hashes', () => {
    expect(toBlake3AssetHash(validBlake3Hash)).toBe(validBlake3AssetHash)
    expect(toBlake3AssetHash('abc')).toBeNull()
    expect(toBlake3AssetHash(undefined)).toBeNull()
  })
})

describe(assetService.uploadAssetFromUrl, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assetService.invalidateInputAssetsIncludingPublic()
  })

  it('does not invalidate cached input assets when the upload response is invalid', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchApiMock
      .mockResolvedValueOnce(buildResponse({ assets: staleAssets }))
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
      .mockResolvedValueOnce(buildResponse({ assets: staleAssets }))
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

  it('does not invalidate cached input assets when the upload response is invalid', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('hello'))
    fetchApiMock
      .mockResolvedValueOnce(buildResponse({ assets: staleAssets }))
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
      .mockResolvedValueOnce(buildResponse({ assets: staleAssets }))
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

describe(assetService.getAllAssetsByTag, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('paginates tagged asset requests with include_public=true', async () => {
    fetchApiMock
      .mockResolvedValueOnce(
        buildResponse({
          assets: [
            validAsset({ id: 'a', tags: ['input'] }),
            validAsset({ id: 'b', tags: ['input'] })
          ]
        })
      )
      .mockResolvedValueOnce(
        buildResponse({
          assets: [validAsset({ id: 'c', tags: ['input'] })]
        })
      )

    const assets = await assetService.getAllAssetsByTag('input', true, {
      limit: 2
    })

    expect(assets.map((a) => a.id)).toEqual(['a', 'b', 'c'])

    const firstUrl = fetchApiMock.mock.calls[0]?.[0] as string
    const firstParams = new URL(firstUrl, 'http://localhost').searchParams
    expect(firstParams.get('include_public')).toBe('true')
    expect(firstParams.get('limit')).toBe('2')
    expect(firstParams.has('offset')).toBe(false)

    const secondUrl = fetchApiMock.mock.calls[1]?.[0] as string
    const secondParams = new URL(secondUrl, 'http://localhost').searchParams
    expect(secondParams.get('include_public')).toBe('true')
    expect(secondParams.get('limit')).toBe('2')
    expect(secondParams.get('offset')).toBe('2')
  })

  it('paginates from raw response size before filtering missing-tagged assets', async () => {
    fetchApiMock
      .mockResolvedValueOnce(
        buildResponse({
          assets: [
            validAsset({ id: 'visible', tags: ['input'] }),
            validAsset({ id: 'hidden', tags: ['input', MISSING_TAG] })
          ]
        })
      )
      .mockResolvedValueOnce(
        buildResponse({
          assets: [validAsset({ id: 'later-public', tags: ['input'] })]
        })
      )

    const assets = await assetService.getAllAssetsByTag('input', true, {
      limit: 2
    })

    expect(assets.map((a) => a.id)).toEqual(['visible', 'later-public'])
    expect(fetchApiMock).toHaveBeenCalledTimes(2)

    const secondUrl = fetchApiMock.mock.calls[1]?.[0]
    if (typeof secondUrl !== 'string') {
      throw new Error('Expected a second asset request URL')
    }
    const secondParams = new URL(secondUrl, 'http://localhost').searchParams
    expect(secondParams.get('offset')).toBe('2')
  })

  it('honors has_more when walking tagged asset pages', async () => {
    fetchApiMock
      .mockResolvedValueOnce(
        buildResponse({
          assets: [
            validAsset({ id: 'first', tags: ['input'] }),
            validAsset({ id: 'second', tags: ['input'] })
          ],
          has_more: true
        })
      )
      .mockResolvedValueOnce(
        buildResponse({
          assets: [validAsset({ id: 'later-public', tags: ['input'] })],
          has_more: false
        })
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
    expect(secondParams.get('offset')).toBe('2')
  })

  it('passes abort signals through paginated requests', async () => {
    const controller = new AbortController()
    fetchApiMock.mockResolvedValueOnce(
      buildResponse({
        assets: [validAsset({ id: 'a', tags: ['input'] })]
      })
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
      return buildResponse({
        assets: [
          validAsset({ id: 'a', tags: ['input'] }),
          validAsset({ id: 'b', tags: ['input'] })
        ]
      })
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
    fetchApiMock.mockResolvedValueOnce(buildResponse({ assets }))

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

  it('fetches fresh input assets after explicit invalidation', async () => {
    const staleAssets = [validAsset({ id: 'stale-input', tags: ['input'] })]
    const freshAssets = [validAsset({ id: 'fresh-input', tags: ['input'] })]
    fetchApiMock
      .mockResolvedValueOnce(buildResponse({ assets: staleAssets }))
      .mockResolvedValueOnce(buildResponse({ assets: freshAssets }))

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

    resolveResponse(buildResponse({ assets }))

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

    resolveResponse(buildResponse({ assets }))
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
      .mockResolvedValueOnce(buildResponse({ assets: freshAssets }))

    const inFlight = assetService.getInputAssetsIncludingPublic()
    assetService.invalidateInputAssetsIncludingPublic()

    resolveResponse(buildResponse({ assets }))

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
      .mockResolvedValueOnce(buildResponse({ assets: staleAssets }))
      .mockResolvedValueOnce(buildResponse(null))
      .mockResolvedValueOnce(buildResponse({ assets: freshAssets }))

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
      .mockResolvedValueOnce(buildResponse({ assets: staleAssets }))
      .mockResolvedValueOnce(buildResponse(uploadedAsset))
      .mockResolvedValueOnce(buildResponse({ assets: freshAssets }))

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
      .mockResolvedValueOnce(buildResponse({ assets: staleAssets }))
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
      .mockResolvedValueOnce(buildResponse({ assets: staleAssets }))
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

describe(assetService.checkAssetHash, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    [200, 'exists'],
    [404, 'missing'],
    [400, 'invalid']
  ] as const)('maps %s responses to %s', async (status, expected) => {
    const hash =
      'blake3:1111111111111111111111111111111111111111111111111111111111111111'
    fetchApiMock.mockResolvedValueOnce(buildResponse(null, { status }))

    await expect(assetService.checkAssetHash(hash)).resolves.toBe(expected)

    expect(fetchApiMock).toHaveBeenCalledWith(
      `/assets/hash/${encodeURIComponent(hash)}`,
      {
        method: 'HEAD',
        signal: undefined
      }
    )
  })

  it('throws for unexpected responses', async () => {
    fetchApiMock.mockResolvedValueOnce(buildResponse(null, { status: 500 }))

    await expect(assetService.checkAssetHash('blake3:abc')).rejects.toThrow(
      'Unexpected asset hash check status: 500'
    )
  })
})
