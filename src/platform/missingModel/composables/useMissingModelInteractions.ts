import { reactive } from 'vue'
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
import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'
import type { SelectOption } from '@/components/input/types'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useAssetsStore } from '@/stores/assetsStore'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { app } from '@/scripts/app'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

const importSources = [civitaiImportSource, huggingfaceImportSource]

/** Known model type tags that correspond to directory names. */
const MODEL_TYPE_TAGS = [
  'checkpoints',
  'loras',
  'vae',
  'text_encoders',
  'diffusion_models'
] as const

// Module-level shared state (survives component re-mounts)
// Expand state per model (default collapsed, like MissingPackGroupRow)
const modelExpandState = reactive<Record<string, boolean>>({})

export function getModelStateKey(
  modelName: string,
  directory: string | null,
  isUnsupported: boolean
): string {
  const prefix = isUnsupported ? 'unsup' : 'sup'
  return `${prefix}::${directory ?? ''}::${modelName}`
}

const selectedLibraryModel = reactive<Record<string, string>>({})

const importTaskIds = reactive<Record<string, string>>({})

const importCategoryMismatch = reactive<Record<string, string>>({})

const urlInputs = reactive<Record<string, string>>({})
const urlMetadata = reactive<Record<string, AssetMetadata | null>>({})
const urlFetching = reactive<Record<string, boolean>>({})
const urlErrors = reactive<Record<string, string>>({})
const urlImporting = reactive<Record<string, boolean>>({})
const urlDebounceTimers = reactive<
  Record<string, ReturnType<typeof setTimeout>>
>({})

function getNodeDisplayLabel(
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
  if (!model.nodeId) return null

  const graph = app.rootGraph
  if (!graph) return null
  const node = getNodeByExecutionId(graph, String(model.nodeId))
  if (!node) return null

  const widget = node.widgets?.find((w) => w.name === model.widgetName)
  if (!widget) return null

  return { node, widget }
}

function getComboValue(model: MissingModelCandidate): string | undefined {
  const result = getModelComboWidget(model)
  if (!result) return undefined
  const val = result.widget.value
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  return ''
}

export function useMissingModelInteractions() {
  const { t } = useI18n()
  const executionErrorStore = useExecutionErrorStore()
  const assetsStore = useAssetsStore()
  const assetDownloadStore = useAssetDownloadStore()
  const modelToNodeStore = useModelToNodeStore()

  function toggleModelExpand(key: string) {
    modelExpandState[key] = !isModelExpanded(key)
  }

  function isModelExpanded(key: string): boolean {
    return modelExpandState[key] ?? false
  }

  /** Load options from asset store for asset-supported nodes, or from widget values. */
  function getComboOptions(model: MissingModelCandidate): SelectOption[] {
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
      selectedLibraryModel[key] = value
    }
  }

  function isCheckReady(key: string): boolean {
    if (!selectedLibraryModel[key]) return false
    if (importCategoryMismatch[key]) return false

    const status = getDownloadStatus(key)
    if (
      status &&
      (status.status === 'running' || status.status === 'created')
    ) {
      return false
    }
    return true
  }

  function cancelLibrarySelect(key: string) {
    delete selectedLibraryModel[key]
    delete importCategoryMismatch[key]
  }

  /**
   * Apply the selected library model to all referencing nodes and clear errors.
   */
  function confirmLibrarySelect(
    key: string,
    referencingNodes: Array<{ nodeId: string | number; widgetName: string }>,
    directory: string | null
  ) {
    const value = selectedLibraryModel[key]
    if (!value) return

    const graph = app.rootGraph
    if (!graph) return

    // Refresh model caches so the widget dropdown shows the new model
    if (directory) {
      const providers = modelToNodeStore.getAllNodeProviders(directory)
      Promise.allSettled(
        providers.map((provider) =>
          assetsStore.updateModelsForNodeType(provider.nodeDef.name)
        )
      ).catch(() => {
        // Silently ignore refresh failures
      })
    }

    // Update ALL referencing nodes' widgets with the selected value
    for (const ref of referencingNodes) {
      const node = getNodeByExecutionId(graph, String(ref.nodeId))
      if (node) {
        const widget = node.widgets?.find((w) => w.name === ref.widgetName)
        if (widget) {
          widget.value = value
        }
      }
    }

    // Clean up
    delete selectedLibraryModel[key]

    // Remove only the specific candidates that belong to this group
    const nodeIdSet = new Set(referencingNodes.map((ref) => String(ref.nodeId)))
    executionErrorStore.removeMissingModelsByNodeIds(nodeIdSet)
  }

  function handleUrlInput(key: string, value: string) {
    urlInputs[key] = value

    // Clear previous state
    delete urlMetadata[key]
    delete urlErrors[key]
    urlFetching[key] = false

    // Clear previous debounce timer
    if (urlDebounceTimers[key]) {
      clearTimeout(urlDebounceTimers[key])
      delete urlDebounceTimers[key]
    }

    const trimmed = value.trim()
    if (!trimmed) return

    // Debounce: wait 800ms after last keystroke
    urlDebounceTimers[key] = setTimeout(() => {
      void fetchUrlMetadata(key, trimmed)
    }, 800)
  }

  async function fetchUrlMetadata(key: string, url: string) {
    const source = importSources.find((s) => validateSourceUrl(url, s))
    if (!source) {
      urlErrors[key] = t('rightSidePanel.missingModels.unsupportedUrl')
      return
    }

    urlFetching[key] = true
    delete urlErrors[key]

    try {
      const metadata = await assetService.getAssetMetadata(url)

      if (metadata.filename) {
        try {
          metadata.filename = decodeURIComponent(metadata.filename)
        } catch {
          /* keep original */
        }
      }

      urlMetadata[key] = metadata
    } catch (error) {
      urlErrors[key] =
        error instanceof Error
          ? error.message
          : t('rightSidePanel.missingModels.metadataFetchFailed')
    } finally {
      urlFetching[key] = false
    }
  }

  function getTypeMismatch(
    key: string,
    groupDirectory: string | null
  ): string | null {
    if (!groupDirectory) return null

    const metadata = urlMetadata[key]
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

  function getDownloadStatus(key: string) {
    const taskId = importTaskIds[key]
    if (!taskId) return null
    return (
      assetDownloadStore.downloadList.find((d) => d.taskId === taskId) ?? null
    )
  }

  async function handleImport(key: string, groupDirectory: string | null) {
    const metadata = urlMetadata[key]
    if (!metadata) return

    const url = urlInputs[key]?.trim()
    if (!url) return

    const source = importSources.find((s) => validateSourceUrl(url, s))
    if (!source) return

    urlImporting[key] = true
    delete urlErrors[key]

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

      if (result.type === 'async' && result.task.status !== 'completed') {
        const taskId = result.task.task_id
        importTaskIds[key] = taskId

        if (modelType) {
          assetDownloadStore.trackDownload(taskId, modelType, filename)
        }
      } else if (
        result.type === 'async' &&
        result.task.status === 'completed'
      ) {
        // Task completed immediately — no WebSocket event will fire,
        // so refresh the asset cache here.
        if (modelType) {
          assetsStore.invalidateModelsForCategory(modelType)
          void assetsStore.updateModelsForTag(modelType)
        }
      } else if (result.type === 'sync') {
        const existingTags = result.asset.tags ?? []
        const existingCategory = existingTags.find((tag) =>
          MODEL_TYPE_TAGS.includes(tag as (typeof MODEL_TYPE_TAGS)[number])
        )
        if (existingCategory && modelType && existingCategory !== modelType) {
          importCategoryMismatch[key] = existingCategory
        }
      }

      selectedLibraryModel[key] = filename
    } catch (error) {
      urlErrors[key] =
        error instanceof Error
          ? error.message
          : t('rightSidePanel.missingModels.metadataFetchFailed')
    } finally {
      urlImporting[key] = false
    }
  }

  return {
    modelExpandState,
    selectedLibraryModel,
    importCategoryMismatch,
    urlInputs,
    urlMetadata,
    urlFetching,
    urlErrors,
    urlImporting,

    toggleModelExpand,
    isModelExpanded,
    getNodeDisplayLabel,
    getComboValue,
    getComboOptions,
    handleComboSelect,
    isCheckReady,
    cancelLibrarySelect,
    confirmLibrarySelect,
    handleUrlInput,
    getTypeMismatch,
    getDownloadStatus,
    handleImport
  }
}
