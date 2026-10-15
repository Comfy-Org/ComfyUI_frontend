import type { Mock } from 'vitest'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_PAGE_SIZE } from '@/constants/searchConstants'
import { useAlgoliaSearchProvider } from '@/services/providers/algoliaSearchProvider'

import recorded from './__fixtures__/algoliaNodesIndex.json'

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

const responses: Record<string, RecordedResponse> = recorded.responses

const SUGGESTIONS_INDEX = 'nodes_index_query_suggestions'

vi.mock(import('algoliasearch/dist/lite/builds/browser'), () => ({
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
  const hitsPerPage = request.hitsPerPage ?? DEFAULT_PAGE_SIZE
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
  vi.mocked(algoliasearch, { partial: true }).mockReturnValue({ search })

  // The provider's result cache is module-level, so it outlives each test.
  useAlgoliaSearchProvider().clearSearchCache()
})

const searchPacks = (query: string, pageNumber = 0) =>
  useAlgoliaSearchProvider().searchPacks(query, {
    pageSize: DEFAULT_PAGE_SIZE,
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

    it('tries the owner-stripped slug before its separator-split form', async () => {
      await searchPacks('kijai/comfyui-kjnodes')

      expect(nodesIndexQueries()).toEqual([
        'kijai/comfyui-kjnodes',
        'comfyui-kjnodes',
        'comfyui kjnodes'
      ])
    })
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
          responses[query].hits
            .slice(0, DEFAULT_PAGE_SIZE)
            .map((hit) => hit.name)
        )
      }
    )
  })

  describe('pagination', () => {
    it('requests no fallbacks beyond the first page', async () => {
      await searchPacks('kijai/comfyui-kjnodes', 1)

      expect(nodesIndexQueries()).toEqual(['kijai/comfyui-kjnodes'])
    })
  })
})
