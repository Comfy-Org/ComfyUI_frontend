import { describe, expect, it } from 'vitest'

import recorded from '../src/services/providers/__fixtures__/algoliaNodesIndex.json'
import type {
  NodesIndexFixture,
  RecordedResponse
} from './record-algolia-nodes-fixture'
import {
  RECORDED_QUERIES,
  recordNodesIndex,
  toRecordedResponse
} from './record-algolia-nodes-fixture'

const committedFixture: NodesIndexFixture = recorded

const indexFrom =
  (responses: Record<string, RecordedResponse>) => async (queries: string[]) =>
    queries.map((query) => {
      if (!(query in responses)) throw new Error(`Unrecorded query "${query}"`)
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
})

describe('toRecordedResponse', () => {
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
