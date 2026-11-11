import { reportError } from '@comfyorg/telemetry/reportError'

import { isGeneratedTempOutput } from '@/platform/assets/adapters/outputAssetMappers'
import type { AssetItem } from '@comfyorg/assets-core/schema'
import { getAssetStoredFilename } from '@/platform/assets/utils/assetStoragePolicy'
import {
  getOutputSubfolder,
  getAssetType
} from '@comfyorg/assets-core/metadata'
import { clearDeletedAssetWidgetValues } from '@/platform/assets/integration/clearDeletedAssetWidgetValues'
import { clearNodePreviewCacheForValues } from '@/platform/assets/integration/clearNodePreviewCacheForValues'
import { markDeletedAssetsAsMissingMedia } from '@/platform/assets/integration/markDeletedAssetsAsMissingMedia'
import { withNodeAddSource } from '@/platform/telemetry/nodeAdded/nodeAddSource'
import { useWorkflowActionsService } from '@/platform/workflow/core/services/workflowActionsService'
import type { WorkflowOpenResult } from '@/platform/workflow/core/services/workflowActionsService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  extractApiPromptFromAsset,
  extractWorkflowFromAsset
} from '@/platform/workflow/utils/workflowExtractionUtil'
import { app } from '@/scripts/app'
import { isGraphLoadFailurePresented } from '@/services/graphLoadFailure'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { detectNodeTypeFromFilename } from '@/platform/assets/integration/loaderNodeUtil'
import { isResultItemType } from '@/utils/typeGuardUtil'

export function useAssetEditorActions() {
  const workflowActions = useWorkflowActionsService()
  const litegraphService = useLitegraphService()
  const nodeDefStore = useNodeDefStore()

  function insertAssetLoader(asset: AssetItem, index = 0) {
    const { nodeType, widgetName } = detectNodeTypeFromFilename(asset.name)
    if (!nodeType || !widgetName) return { kind: 'unsupported' } as const

    const center = litegraphService.getCanvasCenter()
    const node = withNodeAddSource('programmatic', () =>
      litegraphService.addNodeOnGraph(nodeDefStore.nodeDefsByName[nodeType], {
        pos: [center[0] + index * 50, center[1] + index * 50]
      })
    )
    if (!node) return { kind: 'failed' } as const

    const assetType = isGeneratedTempOutput(asset)
      ? 'temp'
      : getAssetType(asset, 'input')
    const annotated = createAnnotatedPath({
      filename: getAssetStoredFilename(asset),
      subfolder: getOutputSubfolder(asset.user_metadata) ?? '',
      type: isResultItemType(assetType) ? assetType : undefined
    })
    const widget = node.widgets?.find((w) => w.name === widgetName)
    if (widget) {
      widget.value = annotated
      widget.callback?.(annotated)
    }
    node.graph?.setDirtyCanvas(true, true)
    return { kind: 'success', nodeType } as const
  }

  async function openApiPromptAsWorkflow(
    asset: AssetItem,
    filename: string
  ): Promise<WorkflowOpenResult> {
    try {
      const apiPrompt = await extractApiPromptFromAsset(asset)
      if (!app.isApiJson(apiPrompt)) return { success: false }
      await app.loadApiJson(apiPrompt, filename)
      return { success: true }
    } catch (error) {
      console.error('Failed to open API graph as workflow:', error)
      reportError(error, {
        surface: 'assets',
        errorType: 'asset_api_prompt_open_failure'
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : undefined,
        errorPresentation: isGraphLoadFailurePresented(error)
          ? 'handled'
          : undefined
      }
    }
  }

  async function openAssetWorkflow(asset: AssetItem) {
    const { workflow, filename } = await extractWorkflowFromAsset(asset)
    return workflow
      ? await workflowActions.openWorkflowAction(workflow, filename)
      : await openApiPromptAsWorkflow(asset, filename)
  }

  async function exportAssetWorkflow(asset: AssetItem) {
    const { workflow, filename } = await extractWorkflowFromAsset(asset)
    return await workflowActions.exportWorkflowAction(workflow, filename)
  }

  return { insertAssetLoader, openAssetWorkflow, exportAssetWorkflow }
}

export function reconcileDeletedAssetReferences(deletedVariants: Set<string>) {
  if (!deletedVariants.size) return
  const rootGraph = app.rootGraph
  const nodeOutputStore = useNodeOutputStore()
  markDeletedAssetsAsMissingMedia(rootGraph, deletedVariants)
  clearNodePreviewCacheForValues(rootGraph, deletedVariants, (node) =>
    nodeOutputStore.removeNodeOutputsForNode(node)
  )
  clearDeletedAssetWidgetValues(rootGraph, deletedVariants)
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}
