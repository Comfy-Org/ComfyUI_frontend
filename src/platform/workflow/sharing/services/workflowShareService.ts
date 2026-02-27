import type {
  SharedWorkflowPayload,
  WorkflowPublishResult,
  WorkflowPublishStatus
} from '@/platform/workflow/sharing/types/shareTypes'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type {
  ShareableAssetsResponse,
  WorkflowAsset,
  WorkflowModel
} from '@/schemas/apiSchema'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useAssetsStore } from '@/stores/assetsStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { mapAllNodes } from '@/utils/graphTraversalUtil'

const UPLOAD_FLAGS = [
  'image_upload',
  'animated_image_upload',
  'video_upload',
  'audio_upload'
] as const

type ThumbnailLike = {
  storage_url?: string | null
  thumbnailUrl?: string | null
  thumbnail_url?: string | null
  thumbnail?: string | null
  preview_url?: string | null
  preview?: string | null
}

type AssetSourceType = 'input' | 'output'

function isMediaUploadCombo(input: { type: string }): input is ComboInputSpec {
  if (input.type !== 'COMBO') return false
  const combo = input as ComboInputSpec
  return UPLOAD_FLAGS.some((flag) => combo[flag] === true)
}

function getAssetNodeWidgets(): Record<string, string> {
  const { nodeDefsByName } = useNodeDefStore()
  const result: Record<string, string> = {}

  for (const [nodeTypeName, nodeDef] of Object.entries(nodeDefsByName)) {
    for (const [widgetName, inputSpec] of Object.entries(nodeDef.inputs)) {
      if (isMediaUploadCombo(inputSpec)) {
        result[nodeTypeName] = widgetName
        break
      }
    }
  }

  return result
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

function getNormalizedThumbnailUrl(item: ThumbnailLike): string | null {
  return resolveThumbnailUrl(
    item.storage_url ??
      item.thumbnailUrl ??
      item.thumbnail_url ??
      item.thumbnail ??
      item.preview_url ??
      item.preview ??
      null
  )
}

function normalizeShareableAssetsResponse(
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

function parseAssetWidgetValue(value: string): {
  name: string
  sourceType: AssetSourceType
} {
  const trimmed = value.trim()
  if (trimmed.endsWith(' [output]')) {
    return {
      name: trimmed.slice(0, -' [output]'.length),
      sourceType: 'output'
    }
  }

  return {
    name: trimmed,
    sourceType: 'input'
  }
}

async function getWorkflowAssetsFromGraph(): Promise<WorkflowAsset[]> {
  const graph = app.rootGraph
  if (!graph) return []

  const assetNodeWidgets = getAssetNodeWidgets()
  const assetsStore = useAssetsStore()

  try {
    await assetsStore.updateInputs()
  } catch {
    // Continue with null thumbnails if input assets cannot be refreshed.
  }

  const inputAssets = assetsStore.inputAssets

  return mapAllNodes(graph, (node) => {
    const widgetName = assetNodeWidgets[node.type ?? '']
    if (!widgetName) return undefined

    const widget = node.widgets?.find((w) => w.name === widgetName)
    const value = widget?.value
    if (typeof value !== 'string' || !value.trim()) return undefined

    const { name, sourceType } = parseAssetWidgetValue(value)

    const matchingInputAsset = inputAssets.find(
      (asset) => asset.name === name || asset.asset_hash === name
    )
    const fallbackThumbnailUrl = api.apiURL(
      `/view?filename=${encodeURIComponent(name)}&type=${sourceType}`
    )

    return {
      id: matchingInputAsset?.id ?? name,
      name,
      storage_url: null,
      thumbnailUrl: matchingInputAsset?.preview_url ?? fallbackThumbnailUrl
    } satisfies WorkflowAsset
  })
}

async function getWorkflowModelsFromGraph(): Promise<WorkflowModel[]> {
  const graph = app.rootGraph
  if (!graph) return []

  const registeredTypes = useModelToNodeStore().getRegisteredNodeTypes()
  const assetsStore = useAssetsStore()

  const nodeTypesInGraph = new Set(
    mapAllNodes(graph, (node) => {
      const nodeType = node.type ?? ''
      return registeredTypes[nodeType] ? nodeType : undefined
    })
  )

  await Promise.allSettled(
    [...nodeTypesInGraph].map((nodeType) =>
      assetsStore.updateModelsForNodeType(nodeType)
    )
  )

  // Load the global model index so custom/extension loader nodes that are not
  // registered in modelToNodeStore can still resolve selected model names.
  await assetsStore.updateModelsForTag('models')

  const globalModelAssets = assetsStore.getAssets('tag:models')
  const globalModelByName = new Map(
    globalModelAssets.map((asset) => [asset.name, asset])
  )

  const resolvedModels = new Map<string, WorkflowModel>()

  function toCandidateNames(value: string): string[] {
    const trimmed = value.trim()
    if (!trimmed) return []

    const basename = trimmed.split(/[\\/]/).at(-1) ?? trimmed
    return basename === trimmed ? [trimmed] : [trimmed, basename]
  }

  for (const model of mapAllNodes(graph, (node) => {
    const nodeType = node.type ?? ''
    const widgetKey = registeredTypes[nodeType]
    if (!widgetKey) return undefined

    const widget = node.widgets?.find((w) => w.name === widgetKey)
    const value = widget?.value
    if (typeof value !== 'string' || !value.trim()) return undefined

    const cachedAssets = assetsStore.getAssets(nodeType)
    const matchingAsset = cachedAssets.find((a) => a.name === value)
    if (matchingAsset?.is_immutable) return undefined

    return {
      id: matchingAsset?.id ?? value,
      name: value,
      storage_url: null,
      thumbnailUrl: matchingAsset?.preview_url ?? null
    } satisfies WorkflowModel
  })) {
    resolvedModels.set(model.name, model)
  }

  for (const node of mapAllNodes(graph, (candidateNode) => candidateNode)) {
    for (const widget of node.widgets ?? []) {
      if (typeof widget.value !== 'string') continue

      const modelAsset = toCandidateNames(widget.value)
        .map((candidateName) => globalModelByName.get(candidateName))
        .find((asset) => !!asset)
      if (!modelAsset) continue
      if (modelAsset.is_immutable) continue

      if (!resolvedModels.has(modelAsset.name)) {
        resolvedModels.set(modelAsset.name, {
          id: modelAsset.id,
          name: modelAsset.name,
          storage_url: null,
          thumbnailUrl: modelAsset.preview_url ?? null
        })
      }
    }
  }

  return [...resolvedModels.values()]
}

interface PublishRecord {
  listed?: boolean
  publishedAt?: string | null
  shareId?: string
  shareUrl?: string | null
  workflowId?: string
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

function decodePublishRecord(payload: unknown): PublishRecord | null {
  if (!payload || typeof payload !== 'object') return null

  const record = payload as Record<string, unknown>
  const workflowId =
    typeof record.workflow_id === 'string' ? record.workflow_id : undefined
  const shareId =
    typeof record.share_id === 'string' ? record.share_id : undefined
  const listed = typeof record.listed === 'boolean' ? record.listed : undefined

  const shareUrl = shareId ? normalizeShareUrl(shareId) : undefined
  const publishedAt =
    typeof record.publish_time === 'string' ? record.publish_time : undefined

  return {
    listed,
    publishedAt,
    shareId,
    shareUrl,
    workflowId
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
  if (!payload || typeof payload !== 'object') return null

  const record = payload as Record<string, unknown>
  if (
    typeof record.share_id !== 'string' ||
    typeof record.workflow_id !== 'string' ||
    typeof record.listed !== 'boolean'
  ) {
    return null
  }

  const workflowJson = record.workflow_json
  if (!workflowJson || typeof workflowJson !== 'object') {
    return null
  }

  const publishedAt =
    typeof record.publish_time === 'string'
      ? parsePublishedAt(record.publish_time)
      : null
  const importedAssets = Array.isArray(record.imported_assets)
    ? record.imported_assets
    : []

  return {
    shareId: record.share_id,
    workflowId: record.workflow_id,
    listed: record.listed,
    publishedAt,
    workflowJson: workflowJson as ComfyWorkflowJSON,
    importedAssets
  }
}

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
      return {
        isPublished: false,
        shareId: null,
        shareUrl: null,
        publishedAt: null
      }
    }

    const record = decodePublishRecord(await response.json())
    if (!record || !record.shareId) {
      return {
        isPublished: false,
        shareId: null,
        shareUrl: null,
        publishedAt: null
      }
    }

    const publishedAt = parsePublishedAt(record.publishedAt)
    if (!publishedAt) {
      return {
        isPublished: false,
        shareId: null,
        shareUrl: null,
        publishedAt: null
      }
    }

    return {
      isPublished: true,
      shareId: record.shareId,
      shareUrl: normalizeShareUrl(record.shareId),
      publishedAt
    }
  }

  async function getShareableAssets(
    onRefine?: (result: ShareableAssetsResponse) => void
  ): Promise<ShareableAssetsResponse> {
    const graph = app.rootGraph
    if (!graph) return { assets: [], models: [] }

    let refinedResult: ShareableAssetsResponse | null = null
    const backendCall = app
      .graphToPrompt(graph)
      .then(({ output }) => api.getShareableAssets(output))
      .then((result) => {
        const normalizedResult = normalizeShareableAssetsResponse(result)
        refinedResult = normalizedResult
        onRefine?.(normalizedResult)
      })
      .catch(() => {})

    const [assets, models] = await Promise.all([
      getWorkflowAssetsFromGraph(),
      getWorkflowModelsFromGraph()
    ])

    if (onRefine) {
      return { assets, models }
    }

    await backendCall

    if (refinedResult) {
      return refinedResult
    }

    return { assets, models }
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
