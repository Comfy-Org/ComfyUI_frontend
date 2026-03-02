import type {
  SharedWorkflowPayload,
  WorkflowPublishResult,
  WorkflowPublishStatus
} from '@/platform/workflow/sharing/types/shareTypes'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ShareableAssetsResponse } from '@/schemas/apiSchema'
import {
  zPublishRecordResponse,
  zSharedWorkflowResponse
} from '@/platform/workflow/sharing/schemas/shareSchemas'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

type ThumbnailLike = {
  storage_url?: string | null
  thumbnailUrl?: string | null
  thumbnail_url?: string | null
  thumbnail?: string | null
  preview_url?: string | null
  preview?: string | null
}

function resolveThumbnailUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null

  if (
    rawUrl.startsWith('http://') ||
    rawUrl.startsWith('https://') ||
    rawUrl.startsWith('blob:') ||
    rawUrl.startsWith('data:')
  ) {
    return rawUrl
  }

  if (rawUrl.startsWith('/api/')) {
    return api.fileURL(rawUrl)
  }

  if (rawUrl.startsWith('/view')) {
    return api.apiURL(rawUrl)
  }

  if (rawUrl.startsWith('/')) {
    return api.fileURL(rawUrl)
  }

  return rawUrl
}

function storageUrlToViewThumbnail(storageUrl: string): string {
  const hashFilename = storageUrl.split('/').at(-1) ?? storageUrl
  return `/view?filename=${encodeURIComponent(hashFilename)}&type=input&res=256`
}

function getNormalizedThumbnailUrl(item: ThumbnailLike): string | null {
  const explicitUrl =
    item.thumbnailUrl ??
    item.thumbnail_url ??
    item.thumbnail ??
    item.preview_url ??
    item.preview ??
    null

  if (explicitUrl) return resolveThumbnailUrl(explicitUrl)

  if (item.storage_url) {
    return resolveThumbnailUrl(storageUrlToViewThumbnail(item.storage_url))
  }

  return null
}

export function normalizeShareableAssetsResponse(
  response: ShareableAssetsResponse
): ShareableAssetsResponse {
  return {
    assets: response.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      storage_url: asset.storage_url ?? null,
      thumbnailUrl: getNormalizedThumbnailUrl(asset)
    })),
    models: response.models.map((model) => ({
      id: model.id,
      name: model.name,
      storage_url: model.storage_url ?? null,
      thumbnailUrl: getNormalizedThumbnailUrl(model)
    }))
  }
}

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
    listed: r.listed,
    publishedAt: r.publish_time ? parsePublishedAt(r.publish_time) : null,
    workflowJson: r.workflow_json as ComfyWorkflowJSON,
    importedAssets: r.imported_assets ?? []
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
    shareableAssets: ShareableAssetsResponse
  ): Promise<WorkflowPublishResult> {
    const response = await api.fetchApi(
      `/userdata/${encodeURIComponent(workflowPath)}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: shareableAssets.assets.map((asset) => ({ id: asset.id })),
          models: shareableAssets.models.map((model) => ({ id: model.id }))
        })
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

  async function getShareableAssets(): Promise<ShareableAssetsResponse> {
    const graph = app.rootGraph
    if (!graph) return { assets: [], models: [] }

    const { output } = await app.graphToPrompt(graph)
    const result = await api.getShareableAssets(output)
    return normalizeShareableAssetsResponse(result)
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
