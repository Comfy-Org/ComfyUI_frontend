import { ref, toValue } from 'vue'

import MultiSelectWidget from '@/components/graph/widgets/MultiSelectWidget.vue'
import { registerComboWidgetInventory } from '@/core/graph/widgets/comboWidgetInventory'
import { syncPromotedComboHostOptions } from '@/core/graph/widgets/syncPromotedComboHostOptions'
import { t } from '@/i18n'
import type { LGraph, LGraphNode } from '@comfyorg/litegraph/litegraph'
import { isComboWidget } from '@comfyorg/litegraph/litegraph'
import type { IBaseWidget, IComboWidget } from '@comfyorg/graph-model/widgets'
import { assetService } from '@/platform/assets/services/assetService'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetFilename } from '@/platform/assets/utils/assetMetadataUtils'
import { createAssetWidget } from '@/platform/assets/utils/createAssetWidget'
import { isCloud } from '@/platform/distribution/types'
import { useDeploymentLibraryModelsStore } from '@/platform/workspace/stores/deploymentLibraryModelsStore'
import type {
  ComboInputSpec,
  InputSpec
} from '@comfyorg/graph-model/nodeDefSchemaV2'
import { isComboInputSpec } from '@comfyorg/graph-model/nodeDefSchemaV2'
import { transformInputSpecV2ToV1 } from '@/schemas/nodeDef/migration'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { BaseDOMWidget } from '@comfyorg/litegraph/types/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'
import { addValueControlWidgets } from '@/core/graph/widgets/valueControlWidgets'
import { useAssetsStore } from '@/stores/assetsStore'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

import { useRemoteWidget } from './useRemoteWidget'

const getDefaultValue = (inputSpec: ComboInputSpec) => {
  if (inputSpec.default) return inputSpec.default
  if (inputSpec.options?.length) return inputSpec.options[0]
  if (inputSpec.remote) return 'Loading...'
  return undefined
}

// Map node types to expected media types
const NODE_MEDIA_TYPE_MAP: Partial<
  Record<string, 'image' | 'video' | 'audio'>
> = {
  LoadImage: 'image',
  LoadVideo: 'video',
  LoadAudio: 'audio'
}

// Map node types to placeholder i18n keys
const NODE_PLACEHOLDER_MAP: Record<string, string> = {
  LoadImage: 'widgets.uploadSelect.placeholderImage',
  LoadVideo: 'widgets.uploadSelect.placeholderVideo',
  LoadAudio: 'widgets.uploadSelect.placeholderAudio'
}

const bindDynamicValuesOption = (
  widget: IBaseWidget,
  getValues: (assignedValues: unknown[]) => unknown,
  onAssign?: () => void
) => {
  const options = widget.options
  let fallbackValues = Array.isArray(options.values)
    ? options.values
    : ([] as unknown[])

  Object.defineProperty(options, 'values', {
    configurable: true,
    enumerable: true,
    get: () => {
      const values = getValues(fallbackValues)
      if (values === undefined || values === null) return fallbackValues
      return values
    },
    set: (values: unknown[]) => {
      fallbackValues = Array.isArray(values) ? values : fallbackValues
      onAssign?.()
    }
  })
}

const rootGraphsToSync = new Set<LGraph>()

function syncPromotedHostsOnce(rootGraph: LGraph) {
  if (!rootGraphsToSync.size) {
    queueMicrotask(() => {
      const graphs = [...rootGraphsToSync]
      rootGraphsToSync.clear()
      for (const graph of graphs) syncPromotedComboHostOptions(graph)
    })
  }
  rootGraphsToSync.add(rootGraph)
}

interface LibraryWatch {
  folder: string
  stop?: () => void
}

const libraryWatchesByNode = new WeakMap<LGraphNode, Set<LibraryWatch>>()

function startLibraryWatch(node: LGraphNode, libraryWatch: LibraryWatch) {
  libraryWatch.stop ??= useDeploymentLibraryModelsStore().watchFolder(
    libraryWatch.folder,
    () => {
      if (node.graph) syncPromotedHostsOnce(node.graph.rootGraph)
      else stopLibraryWatch(libraryWatch)
    }
  )
}

function stopLibraryWatch(libraryWatch: LibraryWatch) {
  libraryWatch.stop?.()
  libraryWatch.stop = undefined
}

function libraryWatchesOf(node: LGraphNode): Set<LibraryWatch> {
  const existing = libraryWatchesByNode.get(node)
  if (existing) return existing
  const libraryWatches = new Set<LibraryWatch>()
  libraryWatchesByNode.set(node, libraryWatches)
  const { onAdded, onRemoved } = node
  node.onAdded = function (graph) {
    onAdded?.call(this, graph)
    for (const libraryWatch of libraryWatches) {
      startLibraryWatch(node, libraryWatch)
    }
  }
  node.onRemoved = function () {
    onRemoved?.call(this)
    for (const libraryWatch of libraryWatches) stopLibraryWatch(libraryWatch)
  }
  return libraryWatches
}

function addLibraryModelOptions(
  node: LGraphNode,
  widget: IComboWidget,
  folder: string
) {
  const library = useDeploymentLibraryModelsStore()
  const libraryWatch: LibraryWatch = { folder }
  const libraryWatches = libraryWatchesOf(node)
  libraryWatches.add(libraryWatch)
  startLibraryWatch(node, libraryWatch)
  const { onRemove } = widget
  widget.onRemove = function () {
    onRemove?.call(this)
    libraryWatches.delete(libraryWatch)
    stopLibraryWatch(libraryWatch)
  }
  registerComboWidgetInventory(widget, {
    getStatus: () => library.statusOf(folder),
    waitForSettled: () => library.waitForSettled(folder)
  })
  let joined:
    | { release: unknown[]; names: readonly string[]; values: unknown[] }
    | undefined
  bindDynamicValuesOption(
    widget,
    (release) => {
      const names = library.namesIn(folder)
      if (!names.length) return release
      if (joined?.release !== release || joined.names !== names) {
        const listed = new Set(release)
        joined = {
          release,
          names,
          values: [...release, ...names.filter((name) => !listed.has(name))]
        }
      }
      return joined.values
    },
    () => library.refresh(folder)
  )
}

const addMultiSelectWidget = (
  node: LGraphNode,
  inputSpec: ComboInputSpec
): IBaseWidget => {
  const widgetValue = ref<string[]>([])
  const widget = new ComponentWidgetImpl({
    node,
    name: inputSpec.name,
    component: MultiSelectWidget,
    inputSpec,
    options: {
      getValue: () => widgetValue.value,
      setValue: (value: string[]) => {
        widgetValue.value = value
      }
    }
  })
  addWidget(node, widget as BaseDOMWidget)
  // TODO: Add remote support to multi-select widget
  // https://github.com/Comfy-Org/ComfyUI_frontend/issues/3003
  if (inputSpec.control_after_generate) {
    const defaultType =
      typeof inputSpec.control_after_generate === 'string'
        ? inputSpec.control_after_generate
        : 'fixed'
    widget.linkedWidgets = addValueControlWidgets(
      node,
      widget,
      defaultType,
      undefined,
      transformInputSpecV2ToV1(inputSpec)
    )
  }

  return widget
}

/**
 * Resolve the default value for a cloud asset widget.
 * Priority: inputSpec.default (if present in cloud assets) → first cloud
 * asset → undefined (shows placeholder).
 */
function resolveCloudDefault(
  nodeType: string,
  specDefault: string | undefined
): string | undefined {
  const assets = useAssetsStore().getAssets(nodeType)
  if (specDefault != null) {
    const inAssets = assets.some((a) => getAssetFilename(a) === specDefault)
    if (inAssets) return specDefault
  }
  // empty filename → undefined (shows placeholder)
  const filename = assets.length ? getAssetFilename(assets[0]) : undefined
  return filename || undefined
}

function getCloudInputAssets(nodeType: string | undefined): AssetItem[] {
  const mediaType = NODE_MEDIA_TYPE_MAP[nodeType ?? '']
  if (!mediaType) return []

  return toValue(useAssetsStore().inputAssets.items).filter(
    (asset) =>
      getCloudInputAssetValue(asset) &&
      getMediaTypeFromFilename(asset.name) === mediaType
  )
}

function getCloudInputAssetValue(asset: AssetItem): string | undefined {
  return asset.hash ?? undefined
}

function getCloudInputAssetValues(nodeType: string | undefined): string[] {
  return getCloudInputAssets(nodeType)
    .map(getCloudInputAssetValue)
    .filter((value): value is string => !!value)
}

function resolveCloudInputDefault(
  nodeType: string | undefined,
  specDefault: string | undefined
): string | undefined {
  const assets = getCloudInputAssets(nodeType)
  if (specDefault != null) {
    const matchingAsset =
      assets.find((asset) => getCloudInputAssetValue(asset) === specDefault) ??
      assets.find((asset) => asset.name === specDefault)
    if (matchingAsset) return getCloudInputAssetValue(matchingAsset)
  }

  return assets[0] ? getCloudInputAssetValue(assets[0]) : undefined
}

function createAssetBrowserWidget(
  node: LGraphNode,
  inputSpec: ComboInputSpec,
  defaultValue: string | undefined
): IBaseWidget {
  return createAssetWidget({
    node,
    widgetName: inputSpec.name,
    nodeTypeForBrowser: node.comfyClass ?? '',
    inputNameForBrowser: inputSpec.name,
    defaultValue
  })
}

const createInputMappingWidget = (
  node: LGraphNode,
  inputSpec: ComboInputSpec,
  defaultValue: string | undefined
): IBaseWidget => {
  const assetsStore = useAssetsStore()

  const widget = node.addWidget(
    'combo',
    inputSpec.name,
    defaultValue ?? '',
    () => {},
    {
      values: [],
      getOptionLabel: (value?: string | null) => {
        if (!value) {
          const placeholderKey =
            NODE_PLACEHOLDER_MAP[node.comfyClass ?? ''] ??
            'widgets.uploadSelect.placeholder'
          return t(placeholderKey)
        }
        return assetsStore.getInputName(value)
      }
    }
  )

  async function loadAll() {
    while (toValue(assetsStore.inputAssets.hasMore)) {
      if (!(await assetsStore.inputAssets.loadMore())) break
      node.setDirtyCanvas(true, false)
    }
  }
  void loadAll()

  bindDynamicValuesOption(widget, () =>
    getCloudInputAssetValues(node.comfyClass)
  )

  if (inputSpec.control_after_generate) {
    if (!isComboWidget(widget)) {
      throw new Error(`Expected combo widget but received ${widget.type}`)
    }
    const defaultType =
      typeof inputSpec.control_after_generate === 'string'
        ? inputSpec.control_after_generate
        : 'randomize'
    widget.linkedWidgets = addValueControlWidgets(
      node,
      widget,
      defaultType,
      undefined,
      transformInputSpecV2ToV1(inputSpec)
    )
  }

  return widget
}

const addComboWidget = (
  node: LGraphNode,
  inputSpec: ComboInputSpec
): IBaseWidget => {
  const defaultValue = getDefaultValue(inputSpec)

  if (isCloud) {
    if (
      assetService.shouldUseWidgetAssetPicker(node.comfyClass, inputSpec.name)
    ) {
      // Default from cloud assets, not from server combo options.
      // Server options list local files that may not exist in the user's
      // cloud asset library, leading to missing-model errors on undo/reload.
      const cloudDefault = resolveCloudDefault(
        node.comfyClass ?? '',
        inputSpec.default
      )
      return createAssetBrowserWidget(node, inputSpec, cloudDefault)
    }

    if (NODE_MEDIA_TYPE_MAP[node.comfyClass ?? '']) {
      return createInputMappingWidget(
        node,
        inputSpec,
        resolveCloudInputDefault(node.comfyClass, inputSpec.default)
      )
    }
  }

  const libraryFolder = isCloud
    ? useDeploymentLibraryModelsStore().folderFor(
        node.comfyClass ?? '',
        inputSpec.name
      )
    : undefined

  // Standard combo widget
  const widget = node.addWidget(
    'combo',
    inputSpec.name,
    defaultValue,
    () => {},
    {
      values: inputSpec.options ?? []
    }
  )

  if (inputSpec.remote) {
    if (!isComboWidget(widget)) {
      throw new Error(`Expected combo widget but received ${widget.type}`)
    }

    const remoteWidget = useRemoteWidget({
      remoteConfig: inputSpec.remote,
      defaultValue,
      node,
      widget
    })
    if (inputSpec.remote.refresh_button) remoteWidget.addRefreshButton()

    registerComboWidgetInventory(widget, {
      getStatus: remoteWidget.getInventoryStatus,
      waitForSettled: remoteWidget.waitForInventory
    })
    bindDynamicValuesOption(widget, () => remoteWidget.getValue())
  } else if (libraryFolder && isComboWidget(widget)) {
    addLibraryModelOptions(node, widget, libraryFolder)
  }

  if (inputSpec.control_after_generate) {
    if (!isComboWidget(widget)) {
      throw new Error(`Expected combo widget but received ${widget.type}`)
    }

    const defaultType =
      typeof inputSpec.control_after_generate === 'string'
        ? inputSpec.control_after_generate
        : 'randomize'
    widget.linkedWidgets = addValueControlWidgets(
      node,
      widget,
      defaultType,
      undefined,
      transformInputSpecV2ToV1(inputSpec)
    )
  }

  return widget
}

export const useComboWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    if (!isComboInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }
    return inputSpec.multi_select
      ? addMultiSelectWidget(node, inputSpec)
      : addComboWidget(node, inputSpec)
  }

  return widgetConstructor
}
