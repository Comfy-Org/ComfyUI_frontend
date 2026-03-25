import type {
  PublishPrefill,
  SharedWorkflowPayload,
  WorkflowPublishResult,
  WorkflowPublishStatus
} from '@/platform/workflow/sharing/types/shareTypes'
import type { ThumbnailType } from '@/platform/workflow/sharing/types/comfyHubTypes'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { AssetInfo } from '@/schemas/apiSchema'
import {
  zHubWorkflowPrefillResponse,
  zPublishRecordResponse,
  zSharedWorkflowResponse
} from '@/platform/workflow/sharing/schemas/shareSchemas'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

class SharedWorkflowLoadError extends Error {
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

function mapApiThumbnailType(
  value: 'image' | 'video' | 'image_comparison' | null | undefined
): ThumbnailType | undefined {
  if (!value) return undefined
  if (value === 'image_comparison') return 'imageComparison'
  return value
}

interface PrefillMetadataFields {
  description?: string | null
  tags?: string[] | null
  thumbnail_type?: 'image' | 'video' | 'image_comparison' | null
  sample_image_urls?: string[] | null
}

function extractPrefill(fields: PrefillMetadataFields): PublishPrefill | null {
  const description = fields.description ?? undefined
  const tags = fields.tags ?? undefined
  const thumbnailType = mapApiThumbnailType(fields.thumbnail_type)
  const sampleImageUrls = fields.sample_image_urls ?? undefined

  if (
    !description &&
    !tags?.length &&
    !thumbnailType &&
    !sampleImageUrls?.length
  ) {
    return null
  }

  return { description, tags, thumbnailType, sampleImageUrls }
}

function decodeHubWorkflowPrefill(payload: unknown): PublishPrefill | null {
  const result = zHubWorkflowPrefillResponse.safeParse(payload)
  if (!result.success) return null
  return extractPrefill(result.data)
}

function decodePublishRecord(payload: unknown) {
  const result = zPublishRecordResponse.safeParse(payload)
  if (!result.success) return null
  const r = result.data
  return {
    workflowId: r.workflow_id,
    shareId: r.share_id ?? undefined,
    listed: r.listed,
    publishedAt: parsePublishedAt(r.publish_time),
    shareUrl: r.share_id ? normalizeShareUrl(r.share_id) : undefined,
    prefill: null
  }
}

function parsePublishedAt(value: string | null | undefined): Date | null {
  if (!value) return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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

const UNPUBLISHED = {
  isPublished: false,
  shareId: null,
  shareUrl: null,
  publishedAt: null,
  prefill: null
} as const satisfies WorkflowPublishStatus

export function useWorkflowShareService() {
  async function fetchHubWorkflowPrefill(
    shareId: string
  ): Promise<PublishPrefill | null> {
    const response = await api.fetchApi(
      `/hub/workflows/${encodeURIComponent(shareId)}`
    )
    if (!response.ok) {
      throw new Error(
        `Failed to fetch hub workflow details: ${response.status}`
      )
    }

    const prefill = decodeHubWorkflowPrefill(await response.json())
    return prefill
  }

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
    if (!record?.shareId || !record.publishedAt) {
      throw new Error('Failed to publish workflow: invalid response')
    }

    return {
      shareId: record.shareId,
      shareUrl: normalizeShareUrl(record.shareId),
      publishedAt: record.publishedAt
    }
  }

  async function getPublishStatus(
    workflowPath: string
  ): Promise<WorkflowPublishStatus> {
    const response = await api.fetchApi(
      `/userdata/${encodeURIComponent(workflowPath)}/publish`
    )
    if (!response.ok) {
      if (response.status === 404) return UNPUBLISHED
      throw new Error(
        `Failed to fetch publish status: ${response.status} ${response.statusText}`
      )
    }

    const json = await response.json()
    const record = decodePublishRecord(json)
    if (!record || !record.shareId || !record.publishedAt) return UNPUBLISHED

    let prefill: PublishPrefill | null = record.prefill
    if (!prefill && record.listed) {
      try {
        prefill = await fetchHubWorkflowPrefill(record.shareId)
      } catch {
        prefill = null
      }
    }

    return {
      isPublished: true,
      shareId: record.shareId,
      shareUrl: normalizeShareUrl(record.shareId),
      publishedAt: record.publishedAt,
      prefill
    }
  }

  async function getShareableAssets(
    includingPublic = false
  ): Promise<AssetInfo[]> {
    const graph = app.rootGraph
    if (!graph) return []

    const { output } = await app.graphToPrompt(graph)
    const { assets } = await api.getShareableAssets(output)

    return includingPublic ? assets : assets.filter((asset) => !asset.public)
  }

  async function getSharedWorkflow(
    shareId: string
  ): Promise<SharedWorkflowPayload> {
    let response: Response
    try {
      response = await api.fetchApi(
        `/workflows/published/${encodeURIComponent(shareId)}`
      )
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

    const validated = await validateComfyWorkflow(workflow.workflowJson)
    if (!validated) {
      throw new Error('Failed to load shared workflow: invalid workflow data')
    }
    workflow.workflowJson = validated

    return workflow
  }

  async function importPublishedAssets(assetIds: string[]): Promise<void> {
    const response = await api.fetchApi('/assets/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published_asset_ids: assetIds })
    })

    if (!response.ok) {
      throw new Error(`Failed to import assets: ${response.status}`)
    }
  }

  return {
    publishWorkflow,
    getPublishStatus,
    getShareableAssets,
    getSharedWorkflow,
    importPublishedAssets
  }
}
