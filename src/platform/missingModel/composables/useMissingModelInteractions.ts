import { useI18n } from 'vue-i18n'

import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { st } from '@/i18n'
import { assetService } from '@/platform/assets/services/assetService'
import {
  getAssetDisplayName,
  getAssetFilename
} from '@/platform/assets/utils/assetMetadataUtils'
import { civitaiImportSource } from '@/platform/assets/importSources/civitaiImportSource'
import { huggingfaceImportSource } from '@/platform/assets/importSources/huggingfaceImportSource'
import { validateSourceUrl } from '@/platform/assets/utils/importSourceUtil'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useAssetsStore } from '@/stores/assetsStore'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { app } from '@/scripts/app'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import type {
  MissingModelCandidate,
  MissingModelDownloadStatus,
  MissingModelViewModel
} from '@/platform/missingModel/types'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

const importSources = [civitaiImportSource, huggingfaceImportSource]

const MODEL_TYPE_TAGS = [
  'checkpoints',
  'loras',
  'vae',
  'text_encoders',
  'diffusion_models'
] as const

const URL_DEBOUNCE_MS = 800

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

function getModelComboWidget(
  model: MissingModelCandidate
): { node: LGraphNode; widget: IBaseWidget } | null {
  if (model.nodeId == null) return null

  const graph = app.rootGraph
  if (!graph) return null
  const node = getNodeByExecutionId(graph, String(model.nodeId))
  if (!node) return null

  const widget = node.widgets?.find((w) => w.name === model.widgetName)
  if (!widget) return null

  return { node, widget }
}

export function getComboValue(
  model: MissingModelCandidate
): string | undefined {
  const result = getModelComboWidget(model)
  if (!result) return undefined
  const val = result.widget.value
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  return undefined
}

export function useMissingModelInteractions() {
  const { t } = useI18n()
  const store = useMissingModelStore()
  const assetsStore = useAssetsStore()
  const assetDownloadStore = useAssetDownloadStore()
  const electronDownloadStore = useElectronDownloadStore()
  const modelToNodeStore = useModelToNodeStore()

  const _requestTokens: Record<string, symbol> = {}

  function toggleModelExpand(key: string) {
    store.modelExpandState[key] = !isModelExpanded(key)
  }

  function isModelExpanded(key: string): boolean {
    return store.modelExpandState[key] ?? false
  }

  function getComboOptions(
    model: MissingModelCandidate
  ): { name: string; value: string }[] {
    if (model.isAssetSupported && model.nodeType) {
      const assets = assetsStore.getAssets(model.nodeType) ?? []
      return assets.map((asset) => ({
        name: getAssetDisplayName(asset),
        value: getAssetFilename(asset)
      }))
    }

    const result = getModelComboWidget(model)
    if (!result) return []
    const values = result.widget.options?.values
    if (!Array.isArray(values)) return []
    return values.map((v) => ({ name: String(v), value: String(v) }))
  }

  function handleComboSelect(key: string, value: string | undefined) {
    if (value) {
      store.selectedLibraryModel[key] = value
    }
  }

  function isSelectionConfirmable(key: string): boolean {
    if (!store.selectedLibraryModel[key]) return false
    if (store.importCategoryMismatch[key]) return false

    const status = getDownloadStatus(key)
    return !status || status.status === 'completed'
  }

  function cancelLibrarySelect(key: string) {
    delete store.selectedLibraryModel[key]
    delete store.importCategoryMismatch[key]
    delete store.downloadRefs[key]
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
    delete store.downloadRefs[key]
    const nodeIdSet = new Set(referencingNodes.map((ref) => String(ref.nodeId)))
    store.removeMissingModelByNameOnNodes(modelName, nodeIdSet)
  }

  function handleUrlInput(key: string, value: string) {
    store.urlInputs[key] = value

    delete store.urlMetadata[key]
    delete store.urlErrors[key]
    delete store.importCategoryMismatch[key]
    store.urlFetching[key] = false

    store.clearDebounceTimer(key)

    const trimmed = value.trim()
    if (!trimmed) return

    store.setDebounceTimer(
      key,
      () => {
        void fetchUrlMetadata(key, trimmed)
      },
      URL_DEBOUNCE_MS
    )
  }

  async function fetchUrlMetadata(key: string, url: string) {
    const source = importSources.find((s) => validateSourceUrl(url, s))
    if (!source) {
      store.urlErrors[key] = t('rightSidePanel.missingModels.unsupportedUrl')
      return
    }

    const token = Symbol()
    _requestTokens[key] = token

    store.urlFetching[key] = true
    delete store.urlErrors[key]

    try {
      const metadata = await assetService.getAssetMetadata(url)

      if (_requestTokens[key] !== token) return

      if (metadata.filename) {
        try {
          const decoded = decodeURIComponent(metadata.filename)
          const basename = decoded.split(/[/\\]/).pop() ?? decoded
          if (!basename.includes('..')) {
            metadata.filename = basename
          }
        } catch {
          /* keep original */
        }
      }

      store.urlMetadata[key] = metadata
    } catch (error) {
      if (_requestTokens[key] !== token) return

      store.urlErrors[key] =
        error instanceof Error
          ? error.message
          : t('rightSidePanel.missingModels.metadataFetchFailed')
    } finally {
      if (_requestTokens[key] === token) {
        store.urlFetching[key] = false
      }
    }
  }

  function getTypeMismatch(
    key: string,
    groupDirectory: string | null
  ): string | null {
    if (!groupDirectory) return null

    const metadata = store.urlMetadata[key]
    if (!metadata?.tags?.length) return null

    const detectedType = metadata.tags.find((tag) =>
      MODEL_TYPE_TAGS.includes(tag as (typeof MODEL_TYPE_TAGS)[number])
    )
    if (!detectedType) return null

    if (detectedType !== groupDirectory) {
      return detectedType
    }
    return null
  }

  function getDownloadStatus(key: string): MissingModelDownloadStatus | null {
    const downloadRef = store.downloadRefs[key]
    if (!downloadRef) return null

    if (downloadRef.kind === 'asset-import') {
      const assetDownload = assetDownloadStore.downloadList.find(
        (download) => download.taskId === downloadRef.taskId
      )

      return assetDownload
        ? {
            progress: assetDownload.progress,
            status: assetDownload.status,
            error: assetDownload.error
          }
        : null
    }

    return electronDownloadStore.findByUrl(downloadRef.url) ?? null
  }

  function handleAsyncPending(
    key: string,
    taskId: string,
    modelType: string | undefined,
    filename: string
  ) {
    store.downloadRefs[key] = { kind: 'asset-import', taskId }
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

  function handleSyncResult(
    key: string,
    tags: string[],
    modelType: string | undefined
  ) {
    const existingCategory = tags.find((tag) =>
      MODEL_TYPE_TAGS.includes(tag as (typeof MODEL_TYPE_TAGS)[number])
    )
    if (existingCategory && modelType && existingCategory !== modelType) {
      store.importCategoryMismatch[key] = existingCategory
    }
  }

  async function handleImport(key: string, groupDirectory: string | null) {
    const metadata = store.urlMetadata[key]
    if (!metadata) return

    const url = store.urlInputs[key]?.trim()
    if (!url) return

    const source = importSources.find((s) => validateSourceUrl(url, s))
    if (!source) return

    const token = Symbol()
    _requestTokens[key] = token

    store.urlImporting[key] = true
    delete store.urlErrors[key]
    delete store.importCategoryMismatch[key]

    try {
      const modelType = groupDirectory || undefined
      const tags = modelType ? ['models', modelType] : ['models']
      const filename = metadata.filename || metadata.name || 'model'

      const result = await assetService.uploadAssetAsync({
        source_url: url,
        tags,
        user_metadata: {
          source: source.type,
          source_url: url,
          model_type: modelType
        }
      })

      if (_requestTokens[key] !== token) return

      if (result.type === 'async' && result.task.status !== 'completed') {
        handleAsyncPending(key, result.task.task_id, modelType, filename)
      } else if (result.type === 'async') {
        handleAsyncCompleted(modelType)
      } else if (result.type === 'sync') {
        handleSyncResult(key, result.asset.tags ?? [], modelType)
      }

      store.selectedLibraryModel[key] = filename
    } catch (error) {
      if (_requestTokens[key] !== token) return

      store.urlErrors[key] =
        error instanceof Error
          ? error.message
          : t('rightSidePanel.missingModels.importFailed')
    } finally {
      if (_requestTokens[key] === token) {
        store.urlImporting[key] = false
      }
    }
  }

  return {
    toggleModelExpand,
    isModelExpanded,
    getComboOptions,
    handleComboSelect,
    isSelectionConfirmable,
    cancelLibrarySelect,
    confirmLibrarySelect,
    handleUrlInput,
    getTypeMismatch,
    getDownloadStatus,
    handleImport
  }
}
