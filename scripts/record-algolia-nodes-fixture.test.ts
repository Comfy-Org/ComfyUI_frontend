import { describe, expect, it } from 'vitest'

import { DEFAULT_PAGE_SIZE } from '../src/constants/searchConstants'
import recorded from '../src/services/providers/__fixtures__/algoliaNodesIndex.json'
import type {
  NodesIndexFixture,
  RecordedResponse
} from '../src/services/providers/__fixtures__/algoliaNodesIndexFixture'
import {
  RECORDED_QUERIES,
  recordNodesIndex,
  toRecordedResponse,
  toRecordingRequest
} from './record-algolia-nodes-fixture'

const committedFixture: NodesIndexFixture = recorded

const indexFrom =
  (responses: Record<string, RecordedResponse>) => async (queries: string[]) =>
    queries.map((query) => {
      if (!Object.hasOwn(responses, query))
        throw new Error(`Unrecorded query "${query}"`)
      return responses[query]
    })

const emptyResponse: RecordedResponse = { nbHits: 0, hits: [] }

describe('recordNodesIndex', () => {
  it('regenerates the committed fixture from the same index answers', async () => {
    const regenerated = await recordNodesIndex(
      indexFrom(committedFixture.responses),
      RECORDED_QUERIES
    )

    expect(regenerated).toEqual(committedFixture)
  })

  it('records rewrites only for seed queries that return no hits', async () => {
    const searched: string[][] = []
    const fixture = await recordNodesIndex(
      async (queries) => {
        searched.push(queries)
        return queries.map((query) =>
          query === 'gguf' ? { nbHits: 1, hits: [] } : emptyResponse
        )
      },
      ['gguf', 'kijai/comfyui-kjnodes']
    )

    expect(searched).toEqual([
      ['gguf', 'kijai/comfyui-kjnodes'],
      ['comfyui-kjnodes', 'comfyui kjnodes']
    ])
    expect(Object.keys(fixture.responses)).toEqual([
      'gguf',
      'kijai/comfyui-kjnodes',
      'comfyui-kjnodes',
      'comfyui kjnodes'
    ])
  })

  it('does not search again for a rewrite that is already a seed query', async () => {
    const searched: string[][] = []
    await recordNodesIndex(
      async (queries) => {
        searched.push(queries)
        return queries.map(() => emptyResponse)
      },
      ['kijai/comfyui-kjnodes', 'comfyui-kjnodes']
    )

    expect(searched).toEqual([
      ['kijai/comfyui-kjnodes', 'comfyui-kjnodes'],
      ['comfyui kjnodes']
    ])
  })

  it.for([
    { returned: 1, error: 'Missing response for query "comfyui-kjnodes"' },
    { returned: 3, error: 'Got 3 responses for 2 queries' }
  ])(
    'rejects an index that answers $returned of 2 queries',
    async ({ returned, error }) => {
      await expect(
        recordNodesIndex(
          async () => Array.from({ length: returned }, () => emptyResponse),
          ['gguf', 'comfyui-kjnodes']
        )
      ).rejects.toThrow(error)
    }
  )

  it('refuses to regenerate from an unrecorded query named like an Object.prototype key', async () => {
    await expect(
      indexFrom(committedFixture.responses)(['constructor'])
    ).rejects.toThrow('Unrecorded query "constructor"')
  })

  it('records a rewrite named like an Object.prototype key', async () => {
    const fixture = await recordNodesIndex(
      async (queries) => queries.map(() => emptyResponse),
      ['-constructor']
    )

    expect(Object.keys(fixture.responses)).toEqual([
      '-constructor',
      'constructor'
    ])
  })
})

describe('toRecordedResponse', () => {
  it('shortens descriptions by code point without splitting a surrogate pair', () => {
    const description = `${'x'.repeat(59)}😀😀`

    const [hit] = toRecordedResponse({
      hits: [{ objectID: 'pack', description }]
    }).hits

    expect(hit.description).toBe(`${'x'.repeat(59)}😀`)
  })

  it('keeps the replayed fields, shortens descriptions and drops node lists', () => {
    const response = toRecordedResponse({
      nbHits: 3,
      hits: [
        {
          objectID: 'comfyui-kjnodes',
          id: 'comfyui-kjnodes',
          name: 'ComfyUI-KJNodes',
          description: 'x'.repeat(100),
          total_install: 42,
          publisher_id: 'kijai',
          latest_version: '1.5.0',
          comfy_nodes: ['GetImageSize']
        }
      ]
    })

    expect(response).toEqual({
      nbHits: 3,
      hits: [
        {
          objectID: 'comfyui-kjnodes',
          id: 'comfyui-kjnodes',
          name: 'ComfyUI-KJNodes',
          description: 'x'.repeat(60),
          total_install: 42,
          publisher_id: 'kijai',
          latest_version: '1.5.0',
          comfy_nodes: []
        }
      ]
    })
  })
})

describe('toRecordingRequest', () => {
  it('sends the packs-mode search request without analytics, retrieving only the recorded fields', () => {
    expect(toRecordingRequest('gguf')).toEqual({
      query: 'gguf',
      indexName: 'nodes_index',
      restrictSearchableAttributes: ['name', 'description'],
      attributesToRetrieve: [
        'id',
        'name',
        'description',
        'total_install',
        'publisher_id',
        'latest_version'
      ],
      hitsPerPage: DEFAULT_PAGE_SIZE,
      page: 0,
      analytics: false
    })
  })
})
