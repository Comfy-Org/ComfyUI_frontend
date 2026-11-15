import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { SearchResponse } from 'algoliasearch/lite'
import { liteClient } from 'algoliasearch/lite'
import { uniq, zip } from 'es-toolkit'

import {
  DEFAULT_PAGE_SIZE,
  PACK_SEARCHABLE_ATTRIBUTES
} from '../src/constants/searchConstants'
import type {
  NodesIndexFixture,
  RecordedResponse
} from '../src/services/providers/__fixtures__/algoliaNodesIndexFixture'
import { buildPackSearchRequest } from '../src/services/providers/algoliaPackSearchRequest'
import type {
  AlgoliaNodePack,
  SearchAttribute
} from '../src/types/algoliaTypes'
import { buildPackSearchFallbacks } from '../src/utils/searchQueryUtil'
import { isMainModule } from './isMainModule'

export const FIXTURE_PATH = fileURLToPath(
  new URL(
    '../src/services/providers/__fixtures__/algoliaNodesIndex.json',
    import.meta.url
  )
)

export const RECORDED_QUERIES = [
  'kijai/comfyui-kjnodes',
  'ainvfx/comfyui-seedvr2_videoupscaler',
  'vrgamedevgirl19/comfyui-vrgamedevgirl',
  'kijai/comfyui-promptrelay',
  'gguf',
  'seedvr2',
  'qwen3',
  'minimax h3',
  'ipadapter',
  'comfyui-kjnodes'
]

const FIXTURE_README = `Recorded from the live Algolia nodes_index so integration tests exercise real result shapes and orderings without network access. Regenerate with ALGOLIA_APP_ID=... ALGOLIA_API_KEY=... pnpm exec tsx scripts/record-algolia-nodes-fixture.ts, after adding any new query to RECORDED_QUERIES there.`

const RECORDED_DESCRIPTION_LENGTH = 60

const RECORDED_ATTRIBUTES: SearchAttribute[] = [
  'id',
  'name',
  'description',
  'total_install',
  'publisher_id',
  'latest_version'
]

type RetrievedHit = { objectID: string } & Partial<
  Pick<
    AlgoliaNodePack,
    | 'id'
    | 'name'
    | 'description'
    | 'total_install'
    | 'publisher_id'
    | 'latest_version'
    | 'comfy_nodes'
  >
>

export type SearchNodesIndex = (
  queries: string[]
) => Promise<RecordedResponse[]>

export function toRecordedResponse(response: {
  nbHits?: number
  hits: RetrievedHit[]
}): RecordedResponse {
  return {
    nbHits: response.nbHits ?? response.hits.length,
    hits: response.hits.map((hit) => ({
      objectID: hit.objectID,
      id: hit.id ?? hit.objectID,
      name: hit.name ?? '',
      description: Array.from(hit.description ?? '')
        .slice(0, RECORDED_DESCRIPTION_LENGTH)
        .join(''),
      total_install: hit.total_install ?? 0,
      publisher_id: hit.publisher_id ?? '',
      latest_version: hit.latest_version ?? '',
      comfy_nodes: []
    }))
  }
}

async function searchAll(
  search: SearchNodesIndex,
  queries: string[]
): Promise<Map<string, RecordedResponse>> {
  if (queries.length === 0) return new Map()
  const responses = await search(queries)
  if (responses.length !== queries.length) {
    const missingQuery = queries.at(responses.length)
    throw new Error(
      missingQuery === undefined
        ? `Got ${responses.length} responses for ${queries.length} queries`
        : `Missing response for query "${missingQuery}"`
    )
  }
  return new Map(zip(queries, responses))
}

export async function recordNodesIndex(
  search: SearchNodesIndex,
  seedQueries: string[]
): Promise<NodesIndexFixture> {
  const rawResponses = await searchAll(search, uniq(seedQueries))
  const fallbackQueries = uniq(
    seedQueries
      .filter((query) => rawResponses.get(query)?.nbHits === 0)
      .flatMap(buildPackSearchFallbacks)
  ).filter((query) => !rawResponses.has(query))
  const fallbackResponses = await searchAll(search, fallbackQueries)

  return {
    _README: FIXTURE_README,
    _recordedFor: seedQueries,
    responses: Object.fromEntries([...rawResponses, ...fallbackResponses])
  }
}

export function toRecordingRequest(query: string) {
  return {
    ...buildPackSearchRequest(query, {
      pageSize: DEFAULT_PAGE_SIZE,
      pageNumber: 0,
      restrictSearchableAttributes: [...PACK_SEARCHABLE_ATTRIBUTES]
    }),
    attributesToRetrieve: RECORDED_ATTRIBUTES,
    analytics: false
  }
}

function liveNodesIndexSearch(appId: string, apiKey: string): SearchNodesIndex {
  const client = liteClient(appId, apiKey)
  return async (queries) => {
    const { results } = await client.search<AlgoliaNodePack>({
      requests: queries.map(toRecordingRequest),
      strategy: 'none'
    })
    return (results as SearchResponse<AlgoliaNodePack>[]).map(
      toRecordedResponse
    )
  }
}

async function main() {
  const appId = process.env.ALGOLIA_APP_ID
  const apiKey = process.env.ALGOLIA_API_KEY
  if (!appId || !apiKey) {
    throw new Error('Set ALGOLIA_APP_ID and ALGOLIA_API_KEY to record.')
  }
  const fixture = await recordNodesIndex(
    liveNodesIndexSearch(appId, apiKey),
    RECORDED_QUERIES
  )
  writeFileSync(FIXTURE_PATH, JSON.stringify(fixture))
  process.stdout.write(
    `Recorded ${Object.keys(fixture.responses).length} queries to ${FIXTURE_PATH}\n`
  )
}

if (isMainModule(import.meta.url)) await main()
