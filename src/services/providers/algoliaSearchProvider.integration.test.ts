import type { Mock } from 'vitest'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_PAGE_SIZE } from '@/constants/searchConstants'
import { useAlgoliaSearchProvider } from '@/services/providers/algoliaSearchProvider'

import recorded from './__fixtures__/algoliaNodesIndex.json'
import type { RecordedResponse } from './__fixtures__/algoliaNodesIndexFixture'

const responses: Record<string, RecordedResponse> = recorded.responses

const SUGGESTIONS_INDEX = 'nodes_index_query_suggestions'

vi.mock(import('algoliasearch/dist/lite/builds/browser'), () => ({
  liteClient: vi.fn()
}))

const replay = (request: {
  query: string
  page?: number
  hitsPerPage?: number
}) => {
  if (!Object.hasOwn(responses, request.query)) {
    throw new Error(
      `No recorded Algolia response for query "${request.query}". ` +
        `Re-record it with scripts/record-algolia-nodes-fixture.ts.`
    )
  }
  const { hits: recordedHits, nbHits } = responses[request.query]
  const hitsPerPage = request.hitsPerPage ?? DEFAULT_PAGE_SIZE
  const page = request.page ?? 0
  const pageStart = page * hitsPerPage
  if (
    pageStart + hitsPerPage > recordedHits.length &&
    recordedHits.length < nbHits
  ) {
    throw new Error(
      `Only the first ${recordedHits.length} of ${nbHits} hits for ` +
        `"${request.query}" are recorded, so page ${page} cannot be replayed.`
    )
  }
  return {
    hits: recordedHits.slice(pageStart, pageStart + hitsPerPage),
    nbHits,
    nbPages: Math.ceil(nbHits / hitsPerPage)
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

  useAlgoliaSearchProvider().clearSearchCache()
})

const searchOutcome = (
  query: string,
  pageNumber = 0,
  pageSize = DEFAULT_PAGE_SIZE
) =>
  useAlgoliaSearchProvider().searchPacks(query, {
    pageSize,
    pageNumber,
    restrictSearchableAttributes: ['name', 'description']
  })

async function searchPacks(...args: Parameters<typeof searchOutcome>) {
  const outcome = await searchOutcome(...args)
  assert(outcome.ok, 'expected the search to succeed')
  return outcome.result
}

const failedWith = (message: string) => ({
  ok: false,
  cause: expect.objectContaining({ message: expect.stringContaining(message) })
})

describe('pack search against recorded live Algolia responses', () => {
  it('refuses to replay an unrecorded query named like an Object.prototype key', async () => {
    await expect(searchOutcome('constructor')).resolves.toEqual(
      failedWith('No recorded Algolia response for query "constructor"')
    )
  })

  describe('pasted owner/repo slugs', () => {
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

    it('flags the raw query as empty, with no further pages, when fallback hits stand in for it', async () => {
      const result = await searchPacks('kijai/comfyui-kjnodes')

      expect(result.nodePacks.length).toBeGreaterThan(0)
      expect(result.rawResultsEmpty).toBe(true)
      expect(result.hasMore).toBe(false)
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
    it.for([
      'gguf',
      'seedvr2',
      'qwen3',
      'minimax h3',
      'ipadapter',
      'comfyui-kjnodes'
    ])(
      'sends a single index query for %s and returns its results untouched',
      async (query) => {
        const { nodePacks, rawResultsEmpty } = await searchPacks(query)

        expect(rawResultsEmpty).toBe(false)
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
    it('reports more pages when the recorded index has more hits than fit on one', async () => {
      const { hasMore } = await searchPacks('qwen3')

      expect(hasMore).toBe(true)
    })

    it('refuses to replay a page past the recorded hits', async () => {
      await expect(searchOutcome('qwen3', 1)).resolves.toEqual(
        failedWith('Only the first 64 of 138 hits for "qwen3" are recorded')
      )
    })

    it('refuses to replay a page that runs past the recorded hits', async () => {
      await expect(searchOutcome('qwen3', 1, 50)).resolves.toEqual(
        failedWith('Only the first 64 of 138 hits for "qwen3" are recorded')
      )
    })

    it('requests no fallbacks beyond the first page', async () => {
      await searchPacks('kijai/comfyui-kjnodes', 1)

      expect(nodesIndexQueries()).toEqual(['kijai/comfyui-kjnodes'])
    })
  })
})
