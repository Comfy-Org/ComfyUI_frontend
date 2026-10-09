import { z } from 'zod'
import { zTestWorkflowSummary } from '@comfyorg/ingest-types/test-workflows/zod'
import { api } from '@/scripts/api'
import {
  getCloudAdaptation,
  zCommunityWorkflowDetail
} from '@/platform/workflow/library/utils/cloudWorkflowAdaptation'

const zCommunityIndex = z.object({
  entries: z.array(
    zTestWorkflowSummary.extend({
      packs: z.array(z.string()),
      models: z.array(z.string()),
      node_types: z.array(z.string())
    })
  )
})

export type CommunityWorkflowIndex = z.infer<typeof zCommunityIndex>
type ReadAsset = (path: string, signal?: AbortSignal | null) => Promise<unknown>

async function readCommunityAsset(path: string, signal?: AbortSignal | null) {
  const response = await api.fetchApi(`/community-corpus/${path}`, {
    signal,
    cache: 'no-store'
  })
  if (!response.ok) return response
  return /workflow(?:\.cloud)?\.json$/.test(path)
    ? response.text()
    : response.json()
}

export async function loadCommunityWorkflowIndex(signal?: AbortSignal | null) {
  const parsed = zCommunityIndex.safeParse(
    await readCommunityAsset('index.json', signal)
  )
  return parsed.success ? parsed.data : undefined
}

export function createCommunityWorkflowRequest(
  readAsset: ReadAsset = readCommunityAsset
) {
  let catalog: CommunityWorkflowIndex | undefined

  return async function request(
    route: string,
    options?: RequestInit
  ): Promise<Response> {
    options?.signal?.throwIfAborted()
    if (!catalog || route === '/test-workflow-library/collections') {
      const index = await readAsset('index.json', options?.signal)
      if (index instanceof Response) return index
      const parsed = zCommunityIndex.safeParse(index)
      if (!parsed.success) return Response.json({}, { status: 502 })
      catalog = parsed.data
    }
    const url = new URL(route, 'https://community.invalid')
    const entries = catalog.entries
    if (url.pathname === '/test-workflow-library/collections') {
      return Response.json({
        collections: [{ id: 'harvey-qa', count: entries.length }],
        truncated: false
      })
    }
    const root = '/test-workflow-library/collections/harvey-qa'
    if (url.pathname === `${root}/facets`) {
      const values = (key: 'tags' | 'tasks' | 'packs' | 'models') =>
        [
          ...new Set(entries.flatMap((entry) => entry[key]).filter(Boolean))
        ].sort()
      return Response.json({
        tags: values('tags'),
        tasks: values('tasks'),
        packs: values('packs'),
        models: values('models'),
        truncated: false
      })
    }
    if (url.pathname === `${root}/entries`) {
      const terms = (url.searchParams.get('q') ?? '')
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean)
      const matching = entries.filter((entry) => {
        const text = [
          entry.name,
          entry.description,
          ...entry.tags,
          ...entry.tasks,
          ...entry.packs,
          ...entry.models,
          ...entry.node_types
        ]
          .join(' ')
          .toLowerCase()
        if (!terms.every((term) => text.includes(term))) return false
        for (const [filter, key] of [
          ['tag', 'tags'],
          ['task', 'tasks'],
          ['pack', 'packs'],
          ['model', 'models']
        ] as const) {
          const value = url.searchParams.get(filter)
          if (value && !entry[key].includes(value)) return false
        }
        const cluster = url.searchParams.get('cluster')
        if (cluster && entry.structural_cluster !== cluster) return false
        const complexity = url.searchParams.get('complexity')
        return (
          !complexity ||
          complexity ===
            (entry.node_count <= 20
              ? 'small'
              : entry.node_count <= 60
                ? 'medium'
                : 'large')
        )
      })
      const offset = Number(url.searchParams.get('cursor') || 0)
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset > matching.length
      )
        return Response.json({}, { status: 400 })
      return Response.json({
        entries: matching.slice(offset, offset + 24),
        total: matching.length,
        unresolved: matching.filter((entry) => entry.unresolved_pack_count > 0)
          .length,
        verified: 0,
        next_cursor: offset + 24 < matching.length ? String(offset + 24) : ''
      })
    }
    const hash = url.pathname.slice(`${root}/entries/`.length)
    if (
      !url.pathname.startsWith(`${root}/entries/`) ||
      !entries.some((entry) => entry.workflow_sha256 === hash)
    )
      return Response.json({}, { status: 404 })
    const asset = await readAsset(`${hash}/detail.json`, options?.signal)
    if (asset instanceof Response) return asset
    const parsed = zCommunityWorkflowDetail.safeParse(asset)
    if (!parsed.success) return Response.json({}, { status: 502 })
    const detail = parsed.data
    if (
      detail.summary.workflow_sha256 !== hash ||
      detail.metadata.workflow_sha256 !== hash
    )
      return Response.json({}, { status: 502 })
    if (url.searchParams.get('include_workflow') === 'true') {
      const graph = await readAsset(`${hash}/workflow.json`, options?.signal)
      if (graph instanceof Response) return graph
      if (typeof graph !== 'string') return Response.json({}, { status: 502 })
      if (url.searchParams.get('include_cloud_workflow') === 'true') {
        if (!getCloudAdaptation(detail))
          return Response.json({}, { status: 409 })
        const cloud = await readAsset(
          `${hash}/workflow.cloud.json`,
          options?.signal
        )
        if (cloud instanceof Response) return cloud
        if (typeof cloud !== 'string') return Response.json({}, { status: 502 })
        return Response.json({
          ...detail,
          workflow_json: graph,
          community_cloud_workflow_json: cloud
        })
      }
      return Response.json({ ...detail, workflow_json: graph })
    }
    return Response.json({
      ...detail,
      community_cloud_adaptation_available: Boolean(getCloudAdaptation(detail))
    })
  }
}
