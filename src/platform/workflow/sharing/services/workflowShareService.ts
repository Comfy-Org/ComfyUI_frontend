import type {
  WorkflowAsset,
  WorkflowModel,
  WorkflowPublishResult,
  WorkflowPublishStatus
} from '@/platform/workflow/sharing/types/shareTypes'
import { app } from '@/scripts/app'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { mapAllNodes } from '@/utils/graphTraversalUtil'

const ASSET_NODE_WIDGETS: Record<string, string> = {
  LoadImage: 'image',
  LoadVideo: 'video',
  LoadAudio: 'audio'
}

interface PublishRecord {
  shareUrl: string
  publishedAt: Date
  publishedVersion: number
}

const publishedWorkflows = new Map<string, PublishRecord>()
const workflowVersions = new Map<string, number>()

function getWorkflowVersion(workflowId: string): number {
  return workflowVersions.get(workflowId) ?? 0
}

function bumpWorkflowVersion(workflowId: string): void {
  workflowVersions.set(workflowId, getWorkflowVersion(workflowId) + 1)
}

export function useWorkflowShareService() {
  async function publishWorkflow(
    workflowId: string
  ): Promise<WorkflowPublishResult> {
    await new Promise((resolve) => setTimeout(resolve, 800))

    const shareUrl = `https://comfy.org/shared/${workflowId}-${Date.now().toString(36)}`
    const publishedAt = new Date()

    publishedWorkflows.set(workflowId, {
      shareUrl,
      publishedAt,
      publishedVersion: getWorkflowVersion(workflowId)
    })

    return { shareUrl, publishedAt }
  }

  function getPublishStatus(workflowId: string): WorkflowPublishStatus {
    const record = publishedWorkflows.get(workflowId)
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
      hasChangesSincePublish:
        getWorkflowVersion(workflowId) > record.publishedVersion
    }
  }

  function markWorkflowChanged(workflowId: string): void {
    bumpWorkflowVersion(workflowId)
  }

  function getWorkflowAssets(): WorkflowAsset[] {
    const graph = app.rootGraph
    if (!graph) return []

    return mapAllNodes(graph, (node) => {
      const widgetName = ASSET_NODE_WIDGETS[node.type ?? '']
      if (!widgetName) return undefined

      const widget = node.widgets?.find((w) => w.name === widgetName)
      const value = widget?.value
      if (typeof value !== 'string' || !value.trim()) return undefined

      return { name: value, thumbnailUrl: null } satisfies WorkflowAsset
    })
  }

  function getWorkflowModels(): WorkflowModel[] {
    const graph = app.rootGraph
    if (!graph) return []

    const registeredTypes = useModelToNodeStore().getRegisteredNodeTypes()

    return mapAllNodes(graph, (node) => {
      const widgetKey = registeredTypes[node.type ?? '']
      if (!widgetKey) return undefined

      const widget = node.widgets?.find((w) => w.name === widgetKey)
      const value = widget?.value
      if (typeof value !== 'string' || !value.trim()) return undefined

      return { name: value } satisfies WorkflowModel
    })
  }

  return {
    publishWorkflow,
    getPublishStatus,
    markWorkflowChanged,
    getWorkflowAssets,
    getWorkflowModels
  }
}
