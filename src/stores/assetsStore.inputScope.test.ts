import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAssetsStore } from '@/stores/assetsStore'
import { api } from '@/scripts/api'

const featureFlags = vi.hoisted(() => ({ assetsEnabled: true }))

vi.mock(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () =>
    fromPartial({
      get flags() {
        return { assetsEnabled: featureFlags.assetsEnabled }
      }
    })
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    fetchApi: vi.fn(),
    getHistory: vi.fn(),
    internalURL: vi.fn((path: string) => `http://localhost${path}`),
    apiURL: vi.fn((path: string) => `http://localhost/api${path}`),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getServerFeature: vi.fn(() => false),
    user: 'test-user'
  }
}))

const fetchApiMock = vi.mocked(api.fetchApi)

function page(names: string[]) {
  const assets = names.map((name) => ({
    id: name,
    name,
    loader_path: name,
    tags: ['input'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  }))
  return new Response(
    JSON.stringify({ assets, total: assets.length, has_more: false }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}

function assetRequests() {
  return fetchApiMock.mock.calls.map(([url]) => {
    const params = new URL(url, 'http://localhost').searchParams
    return {
      tags: params.get('tags_any'),
      includePublic: params.get('include_public')
    }
  })
}

/**
 * Mirrors the ingest contract: the public-inclusive query sees the shared
 * account's template inputs, the owner-only query sees nothing this user owns.
 * The two pages share no asset id, so `overlapping()` cannot bridge them.
 */
function servePagesByScope() {
  fetchApiMock.mockImplementation(async (url: string) =>
    url.includes('include_public=true')
      ? page(['public-template-input'])
      : page([])
  )
}

beforeEach(() => {
  featureFlags.assetsEnabled = true
  fetchApiMock.mockResolvedValue(page([]))
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify([])))
  )
})

describe('assetsStore input asset scope', () => {
  it('requests the Imported list without public assets', async () => {
    useAssetsStore()

    await vi.waitFor(() =>
      expect(assetRequests()).toContainEqual({
        tags: 'input',
        includePublic: 'false'
      })
    )
  })

  it('keeps a public-inclusive input list for widget lookups', async () => {
    const store = useAssetsStore()

    await vi.waitFor(() =>
      expect(assetRequests()).toContainEqual({
        tags: 'input',
        includePublic: 'true'
      })
    )
    expect(store.importedAssets).not.toBe(store.inputAssets)
  })

  it('refetches the Imported list on mutation even when it shares nothing with the public-inclusive list', async () => {
    servePagesByScope()
    const store = useAssetsStore()
    await vi.waitFor(() => expect(assetRequests()).toHaveLength(3))
    fetchApiMock.mockClear()

    await store.invalidateInputAssets()

    expect(assetRequests()).toContainEqual({
      tags: 'input',
      includePublic: 'false'
    })
  })

  it('pulls new uploads into the Imported list on the same terms', async () => {
    servePagesByScope()
    const store = useAssetsStore()
    await vi.waitFor(() => expect(assetRequests()).toHaveLength(3))
    fetchApiMock.mockClear()

    await store.loadNewInputAssets()

    expect(assetRequests()).toContainEqual({
      tags: 'input',
      includePublic: 'false'
    })
  })

  describe('when assets are disabled', () => {
    beforeEach(() => {
      featureFlags.assetsEnabled = false
    })

    it('refreshes the shared local list once', async () => {
      const store = useAssetsStore()
      expect(store.importedAssets).toBe(store.inputAssets)

      const invalidate = vi
        .spyOn(store.inputAssets, 'invalidate')
        .mockResolvedValue(undefined)
      await store.invalidateInputAssets()

      expect(invalidate).toHaveBeenCalledOnce()
    })

    it('pulls new uploads into the shared local list once', async () => {
      const store = useAssetsStore()
      const loadNew = vi
        .spyOn(store.inputAssets, 'loadNew')
        .mockResolvedValue(undefined)

      await store.loadNewInputAssets()

      expect(loadNew).toHaveBeenCalledOnce()
    })
  })
})
