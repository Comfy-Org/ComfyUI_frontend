import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { st } from '@/i18n'
import type { UploadModelSuccess } from '@/platform/assets/composables/useUploadModelWizard'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useAssetsStore } from '@/stores/assetsStore'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { app } from '@/scripts/app'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import type { MissingModelViewModel } from '@/platform/missingModel/types'

export function getModelStateKey(
  modelName: string,
  directory: string | null,
  isAssetSupported: boolean
): string {
  const prefix = isAssetSupported ? 'supported' : 'unsupported'
  return `${prefix}::${directory ?? ''}::${modelName}`
}

export function getNodeDisplayLabel(
  nodeId: string | number,
  fallback: string
): string {
  const graph = app.rootGraph
  if (!graph) return fallback
  const node = getNodeByExecutionId(graph, String(nodeId))
  return resolveNodeDisplayName(node, {
    emptyLabel: fallback,
    untitledLabel: fallback,
    st
  })
}

export function useMissingModelInteractions() {
  const store = useMissingModelStore()
  const assetsStore = useAssetsStore()
  const assetDownloadStore = useAssetDownloadStore()
  const modelToNodeStore = useModelToNodeStore()

  function toggleModelExpand(key: string) {
    store.modelExpandState[key] = !isModelExpanded(key)
  }

  function isModelExpanded(key: string): boolean {
    return store.modelExpandState[key] ?? false
  }

  /** Apply selected model to referencing nodes, removing only that model from the error list. */
  function confirmLibrarySelect(
    key: string,
    modelName: string,
    referencingNodes: MissingModelViewModel['referencingNodes'],
    directory: string | null
  ) {
    const value = store.selectedLibraryModel[key]
    if (!value) return

    const graph = app.rootGraph
    if (!graph) return

    if (directory) {
      const providers = modelToNodeStore.getAllNodeProviders(directory)
      void Promise.allSettled(
        providers.map((provider) =>
          assetsStore.updateModelsForNodeType(provider.nodeDef.name)
        )
      ).then((results) => {
        for (const r of results) {
          if (r.status === 'rejected') {
            console.warn(
              '[Missing Model] Failed to refresh model cache:',
              r.reason
            )
          }
        }
      })
    }

    for (const ref of referencingNodes) {
      const node = getNodeByExecutionId(graph, String(ref.nodeId))
      if (node) {
        const widget = node.widgets?.find((w) => w.name === ref.widgetName)
        if (widget) {
          widget.value = value
          widget.callback?.(value)
        }
        node.graph?.setDirtyCanvas(true, true)
      }
    }

    delete store.selectedLibraryModel[key]
    delete store.importTaskIds[key]
    const nodeIdSet = new Set(referencingNodes.map((ref) => String(ref.nodeId)))
    store.removeMissingModelByNameOnNodes(modelName, nodeIdSet)
  }

  function getDownloadStatus(key: string) {
    const taskId = store.importTaskIds[key]
    if (!taskId) return null
    return (
      assetDownloadStore.downloadList.find((d) => d.taskId === taskId) ?? null
    )
  }

  function handleAsyncPending(
    key: string,
    taskId: string,
    modelType: string | undefined,
    filename: string
  ) {
    store.importTaskIds[key] = taskId
    if (modelType) {
      assetDownloadStore.trackDownload(taskId, modelType, filename)
    }
  }

  function handleAsyncCompleted(modelType: string | undefined) {
    if (modelType) {
      assetsStore.invalidateModelsForCategory(modelType)
      void assetsStore.updateModelsForTag(modelType)
    }
  }

  function handleUploadedModelImport(key: string, result: UploadModelSuccess) {
    if (result.taskId) {
      handleAsyncPending(key, result.taskId, result.modelType, result.filename)
    } else if (result.status === 'success') {
      handleAsyncCompleted(result.modelType)
    }

    store.selectedLibraryModel[key] = result.filename
  }

  return {
    toggleModelExpand,
    isModelExpanded,
    confirmLibrarySelect,
    getDownloadStatus,
    handleUploadedModelImport
  }
}
