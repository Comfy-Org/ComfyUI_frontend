import type { Mock } from 'vitest'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'

import recorded from './__fixtures__/algoliaNodesIndex.json'

/**
 * Integration coverage for the pack-search path: the real gateway, the real
 * Algolia provider and the real query-rewriting utility, wired to a transport
 * that replays responses recorded from the live `nodes_index`. No network.
 *
 * The unit tests next door assert plumbing against hand-written hits. These
 * assert behaviour against the result sets production actually returns, using
 * queries taken from Algolia analytics -- the top no-result queries and the
 * top queries by search volume.
 */
type RecordedResponse = {
  nbHits: number
  hits: {
    objectID: string
    id: string
    name: string
    description: string
    total_install: number
    publisher_id: string
    latest_version: string
    comfy_nodes: string[]
  }[]
}

const responses = recorded.responses as unknown as Record<
  string,
  RecordedResponse
>

const SUGGESTIONS_INDEX = 'nodes_index_query_suggestions'
const PAGE_SIZE = 64

type GlobalWithAlgolia = typeof globalThis & {
  __ALGOLIA_APP_ID__: string
  __ALGOLIA_API_KEY__: string
}
const globalWithAlgolia = globalThis as GlobalWithAlgolia
globalWithAlgolia.__ALGOLIA_APP_ID__ = 'recorded-app-id'
globalWithAlgolia.__ALGOLIA_API_KEY__ = 'recorded-api-key'

vi.mock('algoliasearch/dist/lite/builds/browser', () => ({
  liteClient: vi.fn()
}))

/** Replays a recorded response, paginated the way Algolia paginates. */
const replay = (request: {
  query: string
  page?: number
  hitsPerPage?: number
}) => {
  if (!(request.query in responses)) {
    throw new Error(
      `No recorded Algolia response for query "${request.query}". ` +
        `Re-record the fixture if the query rewriting changed.`
    )
  }
  const recordedHits = responses[request.query].hits
  const hitsPerPage = request.hitsPerPage ?? PAGE_SIZE
  const page = request.page ?? 0
  return {
    hits: recordedHits.slice(page * hitsPerPage, (page + 1) * hitsPerPage),
    nbHits: responses[request.query].nbHits
  }
}

let search: Mock

const nodesIndexQueries = () =>
  search.mock.calls.flatMap((call) =>
    call[0].requests
      .filter((r: { indexName: string }) => r.indexName !== SUGGESTIONS_INDEX)
      .map((r: { query: string }) => r.query)
  )

beforeEach(() => {
  search = vi.fn(({ requests }) => ({
    results: requests.map((request: { indexName: string; query: string }) =>
      request.indexName === SUGGESTIONS_INDEX ? { hits: [] } : replay(request)
    )
  }))
  vi.mocked(algoliasearch).mockReturnValue({ search } as Partial<
    ReturnType<typeof algoliasearch>
  > as ReturnType<typeof algoliasearch>)

  // The provider's result cache is module-level, so it outlives each test.
  useRegistrySearchGateway().clearSearchCache()
  search.mockClear()
})

const searchPacks = (query: string, pageNumber = 0) =>
  useRegistrySearchGateway().searchPacks(query, {
    pageSize: PAGE_SIZE,
    pageNumber,
    restrictSearchableAttributes: ['name', 'description']
  })

describe('pack search against recorded live Algolia responses', () => {
  describe('pasted owner/repo slugs', () => {
    // The three highest-volume no-result queries in Algolia analytics are all
    // of this shape. The raw query returns nothing because `removeWordsIfNoResults`
    // is "none", making the owner segment a required term that matches nothing.
    it.for([
      ['kijai/comfyui-kjnodes', 'ComfyUI-KJNodes'],
      ['ainvfx/comfyui-seedvr2_videoupscaler', 'ComfyUI-SeedVR2_VideoUpscaler'],
      ['vrgamedevgirl19/comfyui-vrgamedevgirl', 'VRGameDevGirl Custom Nodes']
    ])(
      'surfaces the pack a user pasting %s is looking for',
      async ([query, expected]) => {
        expect(responses[query].nbHits).toBe(0)

        const { nodePacks } = await searchPacks(query)

        expect(nodePacks.map((pack) => pack.name)).toContain(expected)
      }
    )

    it('leaves a slug whose pack is absent from the registry at zero results', async () => {
      const { nodePacks } = await searchPacks('kijai/comfyui-promptrelay')

      expect(nodePacks).toHaveLength(0)
    })

    it('tries the owner-stripped slug before its tokenized form', async () => {
      await searchPacks('kijai/comfyui-kjnodes')

      expect(nodesIndexQueries()).toEqual([
        'kijai/comfyui-kjnodes',
        'comfyui-kjnodes',
        'comfyui kjnodes'
      ])
    })
  })

  it('rescues an unsegmented compound name via the tokenized fallback', async () => {
    expect(responses['EulerDiscreteScheduler'].nbHits).toBe(0)

    const { nodePacks } = await searchPacks('EulerDiscreteScheduler')

    expect(nodePacks.map((pack) => pack.name)).toEqual([
      'ComfyUI-EulerFlowMatchingDiscreteScheduler'
    ])
  })

  describe('queries that already work', () => {
    // Every one of these is a top-volume query from the suggestions index.
    // Rewriting must not fire for them: it would cost extra index lookups and
    // could append loosely-related packs beneath the real results.
    it.for(['gguf', 'seedvr2', 'qwen3', 'minimax h3', 'ipadapter'])(
      'sends a single index query for %s and returns its results untouched',
      async (query) => {
        const { nodePacks } = await searchPacks(query)

        expect(nodesIndexQueries()).toEqual([query])
        expect(nodePacks.map((pack) => pack.name)).toEqual(
          responses[query].hits.slice(0, PAGE_SIZE).map((hit) => hit.name)
        )
      }
    )

    it('does not split a version-bearing model name into a bare digit', async () => {
      await searchPacks('seedvr2')

      expect(nodesIndexQueries()).not.toContain('seedvr 2')
    })
  })

  describe('pagination', () => {
    // ManagerDialog appends each page onto the previous ones. Re-running the
    // fallback per page re-appended hits already listed above, because the
    // dedupe set only ever held the current page's own hits.
    it('requests no fallbacks beyond the first page', async () => {
      await searchPacks('kijai/comfyui-kjnodes', 1)

      expect(nodesIndexQueries()).toEqual(['kijai/comfyui-kjnodes'])
    })

    it('never returns more than a page of packs', async () => {
      const { nodePacks } = await searchPacks('kijai/comfyui-kjnodes')

      expect(nodePacks.length).toBeLessThanOrEqual(PAGE_SIZE)
    })
  })

  it('ranks the raw query hits above any rescued ones', async () => {
    const { nodePacks } = await searchPacks('gaclove/comfyui-vfi')
    const rawHitCount = responses['gaclove/comfyui-vfi'].hits.length

    expect(nodePacks.slice(0, rawHitCount).map((pack) => pack.name)).toEqual(
      responses['gaclove/comfyui-vfi'].hits.map((hit) => hit.name)
    )
  })
})
