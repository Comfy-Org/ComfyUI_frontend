import type {
  WorkflowAsset,
  WorkflowModel,
  WorkflowPublishResult,
  WorkflowPublishStatus
} from '@/platform/workflow/sharing/types/shareTypes'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
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

function isMediaUploadCombo(input: { type: string }): input is ComboInputSpec {
  if (input.type !== 'COMBO') return false
  const combo = input as ComboInputSpec
  return UPLOAD_FLAGS.some((flag) => combo[flag] === true)
}

/**
 * Builds a map of node type name → widget name for nodes that have
 * media upload combo inputs (image, video, audio).
 * Dynamically queries node definitions instead of hardcoding node names.
 */
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

  function getWorkflowAssets(): WorkflowAsset[] {
    const graph = app.rootGraph
    if (!graph) return []

    const assetNodeWidgets = getAssetNodeWidgets()

    const results = mapAllNodes(graph, (node) => {
      const widgetName = assetNodeWidgets[node.type ?? '']
      if (!widgetName) return undefined

      const widget = node.widgets?.find((w) => w.name === widgetName)
      const value = widget?.value
      if (typeof value !== 'string' || !value.trim()) return undefined

      return { name: value, thumbnailUrl: null } satisfies WorkflowAsset
    })

    return results
  }

  async function getWorkflowModels(): Promise<WorkflowModel[]> {
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

    await Promise.all(
      [...nodeTypesInGraph].map((nodeType) =>
        assetsStore.updateModelsForNodeType(nodeType)
      )
    )

    const results = mapAllNodes(graph, (node) => {
      const nodeType = node.type ?? ''
      const widgetKey = registeredTypes[nodeType]
      if (!widgetKey) return undefined

      const widget = node.widgets?.find((w) => w.name === widgetKey)
      const value = widget?.value
      if (typeof value !== 'string' || !value.trim()) return undefined

      const cachedAssets = assetsStore.getAssets(nodeType)
      const matchingAsset = cachedAssets.find((a) => a.name === value)
      if (matchingAsset?.is_immutable) return undefined

      return { name: value } satisfies WorkflowModel
    })

    return results
  }

  return {
    publishWorkflow,
    getPublishStatus,
    getWorkflowAssets,
    getWorkflowModels
  }
}
