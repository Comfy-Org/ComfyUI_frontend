import type {
  WorkflowPublishResult,
  WorkflowPublishStatus
} from '@/platform/workflow/sharing/types/shareTypes'
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
      name: asset.name,
      thumbnailUrl: getNormalizedThumbnailUrl(asset)
    })),
    models: response.models.map((model) => ({
      name: model.name,
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
      name,
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

  return mapAllNodes(graph, (node) => {
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
      name: value,
      thumbnailUrl: matchingAsset?.preview_url ?? null
    } satisfies WorkflowModel
  })
}

interface PublishRecord {
  isPublished: boolean
  shareUrl?: string | null
  publishedAt?: string | null
  savedAt?: number | null
}

function decodePublishRecord(payload: unknown): PublishRecord | null {
  if (!payload || typeof payload !== 'object') return null

  const record = payload as Record<string, unknown>
  const isPublished = record.is_published
  if (typeof isPublished !== 'boolean') return null

  const shareUrl =
    typeof record.share_url === 'string' ? record.share_url : undefined
  const publishedAt =
    typeof record.published_at === 'string' ? record.published_at : undefined
  const savedAt =
    typeof record.saved_at === 'number' ? record.saved_at : undefined

  return {
    isPublished,
    shareUrl,
    publishedAt,
    savedAt
  }
}

function parsePublishedAt(value: string | null | undefined): Date | null {
  if (!value) return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeShareUrl(rawShareUrl: string): string {
  const match = rawShareUrl.match(/\/workflows\/shares\/([^/?#]+)/)
  const shareId = match?.[1]
  if (!shareId) {
    return rawShareUrl
  }

  const endpointPath = api.apiURL(`/workflows/shares/${shareId}`)

  if (typeof window === 'undefined' || !window.location?.origin) {
    return endpointPath
  }

  return new URL(endpointPath, window.location.origin).toString()
}

export function useWorkflowShareService() {
  function toSavedAtMs(savedAt: number | string | Date): number {
    if (typeof savedAt === 'number' && Number.isFinite(savedAt)) {
      return savedAt
    }

    if (savedAt instanceof Date) {
      const asMs = savedAt.getTime()
      if (!Number.isNaN(asMs)) return asMs
    }

    if (typeof savedAt === 'string') {
      const asNumber = Number(savedAt)
      if (Number.isFinite(asNumber)) {
        return asNumber
      }

      const asDateMs = Date.parse(savedAt)
      if (!Number.isNaN(asDateMs)) {
        return asDateMs
      }
    }

    throw new Error('Invalid workflow savedAt value')
  }

  async function publishWorkflow(
    workflowPath: string,
    savedAt: number | string | Date
  ): Promise<WorkflowPublishResult> {
    const savedAtMs = toSavedAtMs(savedAt)

    const response = await api.fetchApi('/workflows/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_path: workflowPath, saved_at: savedAtMs })
    })

    if (!response.ok) {
      throw new Error(`Failed to publish workflow: ${response.status}`)
    }

    const body = (await response.json()) as Record<string, unknown>
    const shareUrl =
      typeof body.share_url === 'string' ? body.share_url : undefined
    const publishedAt =
      typeof body.published_at === 'string'
        ? parsePublishedAt(body.published_at)
        : null

    if (!shareUrl || !publishedAt) {
      throw new Error('Failed to publish workflow: invalid response')
    }

    return { shareUrl: normalizeShareUrl(shareUrl), publishedAt }
  }

  async function getPublishStatus(
    workflowPath: string,
    currentSavedAt: number | string | Date
  ): Promise<WorkflowPublishStatus> {
    const currentSavedAtMs = toSavedAtMs(currentSavedAt)

    const response = await api.fetchApi(
      `/workflows/publish-status?path=${encodeURIComponent(workflowPath)}`
    )
    if (!response.ok) {
      return {
        isPublished: false,
        shareUrl: null,
        publishedAt: null,
        hasChangesSincePublish: false
      }
    }

    const record = decodePublishRecord(await response.json())
    if (!record || !record.isPublished) {
      return {
        isPublished: false,
        shareUrl: null,
        publishedAt: null,
        hasChangesSincePublish: false
      }
    }

    const publishedAt = parsePublishedAt(record.publishedAt)
    if (!record.shareUrl || !publishedAt) {
      return {
        isPublished: false,
        shareUrl: null,
        publishedAt: null,
        hasChangesSincePublish: false
      }
    }

    const savedAt = typeof record.savedAt === 'number' ? record.savedAt : null
    const hasChangesSincePublish =
      savedAt === null ? false : currentSavedAtMs > savedAt

    return {
      isPublished: true,
      shareUrl: normalizeShareUrl(record.shareUrl),
      publishedAt,
      hasChangesSincePublish
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

    if (!onRefine) await backendCall

    if (refinedResult) {
      return refinedResult
    }

    return { assets, models }
  }

  return {
    publishWorkflow,
    getPublishStatus,
    getShareableAssets
  }
}
