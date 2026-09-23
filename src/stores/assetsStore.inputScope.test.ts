import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toValue } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useAssetsStore } from '@/stores/assetsStore'
import { api } from '@/scripts/api'

vi.mock(import('@/composables/useFeatureFlags'))

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

/** Only the two input queries; the output query is not under test here. */
function inputRequests() {
  return assetRequests().filter(({ tags }) => tags === 'input')
}

/**
 * Mirrors the ingest contract: public assets are withheld only when the
 * caller asks, so an absent `include_public` still serves them. The owner-only
 * page shares no asset id with the public one, so `overlapping()` cannot
 * bridge the two lists.
 */
function servePagesByScope() {
  fetchApiMock.mockImplementation(async (url: string) => {
    const includePublic =
      new URL(url, 'http://localhost').searchParams.get('include_public') !==
      'false'
    return includePublic ? page(['public-template-input']) : page([])
  })
}

beforeEach(() => {
  vi.mocked(useFeatureFlags().flags).assetsEnabled = true
  fetchApiMock.mockImplementation(async () => page([]))
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

  it('keeps public assets in the widget-facing input list', async () => {
    servePagesByScope()
    const store = useAssetsStore()

    await vi.waitFor(() =>
      expect(toValue(store.inputAssets.items).map(({ id }) => id)).toEqual([
        'public-template-input'
      ])
    )
    expect(toValue(store.importedAssets.items)).toEqual([])
  })

  it('refetches the Imported list on mutation even when it shares nothing with the public-inclusive list', async () => {
    servePagesByScope()
    const store = useAssetsStore()
    await vi.waitFor(() => expect(inputRequests()).toHaveLength(2))
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
    await vi.waitFor(() => expect(inputRequests()).toHaveLength(2))
    fetchApiMock.mockClear()

    await store.loadNewInputAssets()

    expect(assetRequests()).toContainEqual({
      tags: 'input',
      includePublic: 'false'
    })
  })

  describe('when assets are disabled', () => {
    beforeEach(() => {
      vi.mocked(useFeatureFlags().flags).assetsEnabled = false
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
