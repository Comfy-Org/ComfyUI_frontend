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

function logShareableAssetsDebug(
  source: 'backend' | 'fallback',
  result: ShareableAssetsResponse
) {
  const summarize = (
    items: Array<{ name: string; thumbnailUrl?: string | null }>
  ) =>
    items.map((item) => ({
      name: item.name,
      hasThumbnail: Boolean(item.thumbnailUrl),
      thumbnailUrl: item.thumbnailUrl ?? null
    }))

  console.warn(`[share][assets][${source}]`, {
    assets: summarize(result.assets),
    models: summarize(result.models)
  })
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

  const settledResults = await Promise.allSettled(
    [...nodeTypesInGraph].map((nodeType) =>
      assetsStore.updateModelsForNodeType(nodeType)
    )
  )
  for (const result of settledResults) {
    if (result.status === 'rejected') {
      console.error('Failed to update models for node type:', result.reason)
    }
  }

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
  shareUrl: string
  publishedAt: Date
  savedAt: number
}

const publishedWorkflows = new Map<string, PublishRecord>()

export function useWorkflowShareService() {
  async function publishWorkflow(
    workflowPath: string,
    savedAt: number
  ): Promise<WorkflowPublishResult> {
    await new Promise((resolve) => setTimeout(resolve, 800))

    const shareUrl = `https://comfy.org/shared/${workflowPath}-${Date.now().toString(36)}`
    const publishedAt = new Date()

    publishedWorkflows.set(workflowPath, { shareUrl, publishedAt, savedAt })

    return { shareUrl, publishedAt }
  }

  function getPublishStatus(
    workflowPath: string,
    currentSavedAt: number
  ): WorkflowPublishStatus {
    const record = publishedWorkflows.get(workflowPath)
    if (!record) {
      return {
        isPublished: false,
        shareUrl: null,
        publishedAt: null,
        hasChangesSincePublish: false
      }
    }

    return {
      isPublished: true,
      shareUrl: record.shareUrl,
      publishedAt: record.publishedAt,
      hasChangesSincePublish: currentSavedAt > record.savedAt
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
        logShareableAssetsDebug('backend', normalizedResult)
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

    const fallbackResult = { assets, models }
    logShareableAssetsDebug('fallback', fallbackResult)
    return fallbackResult
  }

  return {
    publishWorkflow,
    getPublishStatus,
    getShareableAssets
  }
}
