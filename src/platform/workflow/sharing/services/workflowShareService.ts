import type {
  SharedWorkflowPayload,
  WorkflowPublishResult,
  WorkflowPublishStatus
} from '@/platform/workflow/sharing/types/shareTypes'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { AssetInfo } from '@/schemas/apiSchema'
import {
  zPublishRecordResponse,
  zSharedWorkflowResponse
} from '@/platform/workflow/sharing/schemas/shareSchemas'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

export class SharedWorkflowLoadError extends Error {
  readonly status: number | null

  constructor(status: number | null, message?: string) {
    super(message ?? `Failed to load shared workflow: ${status ?? 'unknown'}`)
    this.name = 'SharedWorkflowLoadError'
    this.status = status
  }

  get isRetryable(): boolean {
    if (this.status === null) return true
    return this.status >= 500 || this.status === 408 || this.status === 429
  }
}

function decodePublishRecord(payload: unknown) {
  const result = zPublishRecordResponse.safeParse(payload)
  if (!result.success) return null
  const r = result.data
  return {
    workflowId: r.workflow_id,
    shareId: r.share_id ?? undefined,
    listed: r.listed,
    publishedAt: r.publish_time ?? undefined,
    shareUrl: r.share_id ? normalizeShareUrl(r.share_id) : undefined
  }
}

function parsePublishedAt(value: string | null | undefined): Date | null {
  if (!value) return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function extractShareId(rawShareUrl: string): string | null {
  const match = rawShareUrl.match(/\/workflows\/published\/([^/?#]+)/)
  return match?.[1] ?? null
}

function normalizeShareUrl(shareId: string): string {
  const queryString = `share=${encodeURIComponent(shareId)}`
  if (typeof window === 'undefined' || !window.location?.origin) {
    return `/?${queryString}`
  }

  const normalizedUrl = new URL(window.location.href)
  normalizedUrl.search = queryString
  normalizedUrl.hash = ''
  return normalizedUrl.toString()
}

function decodeSharedWorkflowPayload(
  payload: unknown
): SharedWorkflowPayload | null {
  const result = zSharedWorkflowResponse.safeParse(payload)
  if (!result.success) return null
  const r = result.data
  return {
    shareId: r.share_id,
    workflowId: r.workflow_id,
    name: r.name,
    listed: r.listed,
    publishedAt: r.publish_time ? parsePublishedAt(r.publish_time) : null,
    workflowJson: r.workflow_json as ComfyWorkflowJSON,
    assets: r.assets
  }
}

const UNPUBLISHED: Readonly<WorkflowPublishStatus> = {
  isPublished: false,
  shareId: null,
  shareUrl: null,
  publishedAt: null
} as const

export function useWorkflowShareService() {
  async function publishWorkflow(
    workflowPath: string,
    shareableAssets: AssetInfo[]
  ): Promise<WorkflowPublishResult> {
    const assetIds = shareableAssets.map((a) => a.id)
    const response = await api.fetchApi(
      `/userdata/${encodeURIComponent(workflowPath)}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_ids: assetIds })
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to publish workflow: ${response.status}`)
    }

    const record = decodePublishRecord(await response.json())
    const publishedAt = parsePublishedAt(record?.publishedAt)
    if (!record?.shareId || !publishedAt) {
      throw new Error('Failed to publish workflow: invalid response')
    }

    return {
      shareId: record.shareId,
      shareUrl: normalizeShareUrl(record.shareId),
      publishedAt
    }
  }

  async function getPublishStatus(
    workflowPath: string
  ): Promise<WorkflowPublishStatus> {
    const response = await api.fetchApi(
      `/userdata/${encodeURIComponent(workflowPath)}/publish`
    )
    if (!response.ok) {
      return UNPUBLISHED
    }

    const record = decodePublishRecord(await response.json())
    if (!record || !record.shareId) {
      return UNPUBLISHED
    }

    const publishedAt = parsePublishedAt(record.publishedAt)
    if (!publishedAt) {
      return UNPUBLISHED
    }

    return {
      isPublished: true,
      shareId: record.shareId,
      shareUrl: normalizeShareUrl(record.shareId),
      publishedAt
    }
  }

  async function getShareableAssets(): Promise<AssetInfo[]> {
    const graph = app.rootGraph
    if (!graph) return []

    const { output } = await app.graphToPrompt(graph)
    const result = await api.getShareableAssets(output)
    return result.assets
  }

  async function getSharedWorkflow(
    shareId: string,
    options?: { import?: boolean }
  ): Promise<SharedWorkflowPayload> {
    let response: Response
    try {
      let url = `/workflows/published/${encodeURIComponent(shareId)}`
      if (options?.import) {
        url += '?import=true'
      }
      response = await api.fetchApi(url)
    } catch {
      throw new SharedWorkflowLoadError(
        null,
        'Failed to load shared workflow: network error'
      )
    }

    if (!response.ok) {
      throw new SharedWorkflowLoadError(response.status)
    }

    const workflow = decodeSharedWorkflowPayload(await response.json())
    if (!workflow) {
      throw new Error('Failed to load shared workflow: invalid response')
    }

    return workflow
  }

  return {
    extractShareId,
    publishWorkflow,
    getPublishStatus,
    getShareableAssets,
    getSharedWorkflow
  }
}
