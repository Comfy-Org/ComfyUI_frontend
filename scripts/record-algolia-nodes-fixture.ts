import { writeFileSync } from 'node:fs'

import type { SearchResponse } from 'algoliasearch/lite'
import { liteClient } from 'algoliasearch/lite'
import { uniq, zip } from 'es-toolkit'

import { DEFAULT_PAGE_SIZE } from '../src/constants/searchConstants'
import type {
  AlgoliaNodePack,
  SearchAttribute
} from '../src/types/algoliaTypes'
import { buildPackSearchFallbacks } from '../src/utils/searchQueryUtil'
import { isMainModule } from './isMainModule'

export const FIXTURE_PATH =
  'src/services/providers/__fixtures__/algoliaNodesIndex.json'

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

const PACK_SEARCHABLE_ATTRIBUTES: SearchAttribute[] = ['name', 'description']

export type RecordedHit = {
  objectID: string
  id: string
  name: string
  description: string
  total_install: number
  publisher_id: string
  latest_version: string
  comfy_nodes: string[]
}

export type RecordedResponse = {
  nbHits: number
  hits: RecordedHit[]
}

export type NodesIndexFixture = {
  _README: string
  _recordedFor: string[]
  responses: Record<string, RecordedResponse>
}

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
      description: (hit.description ?? '').slice(
        0,
        RECORDED_DESCRIPTION_LENGTH
      ),
      total_install: hit.total_install ?? 0,
      publisher_id: hit.publisher_id ?? '',
      latest_version: hit.latest_version ?? '',
      comfy_nodes: []
    }))
  }
}

export async function recordNodesIndex(
  search: SearchNodesIndex,
  seedQueries: string[]
): Promise<NodesIndexFixture> {
  const searchAll = async (
    queries: string[]
  ): Promise<Record<string, RecordedResponse>> =>
    queries.length === 0
      ? {}
      : Object.fromEntries(zip(queries, await search(queries)))

  const rawResponses = await searchAll(uniq(seedQueries))
  const fallbackQueries = uniq(
    seedQueries
      .filter((query) => rawResponses[query].nbHits === 0)
      .flatMap(buildPackSearchFallbacks)
  ).filter((query) => !(query in rawResponses))
  const fallbackResponses = await searchAll(fallbackQueries)

  return {
    _README: FIXTURE_README,
    _recordedFor: seedQueries,
    responses: { ...rawResponses, ...fallbackResponses }
  }
}

function liveNodesIndexSearch(appId: string, apiKey: string): SearchNodesIndex {
  const client = liteClient(appId, apiKey)
  return async (queries) => {
    const { results } = await client.search<AlgoliaNodePack>({
      requests: queries.map((query) => ({
        indexName: 'nodes_index',
        query,
        restrictSearchableAttributes: PACK_SEARCHABLE_ATTRIBUTES,
        attributesToRetrieve: RECORDED_ATTRIBUTES,
        hitsPerPage: DEFAULT_PAGE_SIZE,
        page: 0,
        analytics: false
      })),
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
