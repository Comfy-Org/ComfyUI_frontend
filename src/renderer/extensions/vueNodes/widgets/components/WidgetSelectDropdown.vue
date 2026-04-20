<script setup lang="ts">
import { capitalize } from 'es-toolkit'
import { computed, provide, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import { UPLOAD_SKIPPED_ERROR, useUpload } from '@/composables/useUpload'
import { SUPPORTED_EXTENSIONS_ACCEPT } from '@/extensions/core/load3d/constants'
import { useAssetFilterOptions } from '@/platform/assets/composables/useAssetFilterOptions'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import {
  filterItemByBaseModels,
  filterItemByOwnership
} from '@/platform/assets/utils/assetFilterUtils'
import {
  getAssetBaseModels,
  getAssetDisplayName,
  getAssetFilename
} from '@/platform/assets/utils/assetMetadataUtils'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import FormDropdown from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdown.vue'
import type {
  FilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'
import { AssetKindKey } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type {
  FormDropdownItem,
  LayoutMode
} from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import WidgetLayoutField from '@/renderer/extensions/vueNodes/widgets/components/layout/WidgetLayoutField.vue'
import { useAssetWidgetData } from '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData'
import type { ResultItemType } from '@/schemas/apiSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import type { AssetKind } from '@/types/widgetTypes'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

interface Props {
  widget: SimplifiedWidget<string | undefined>
  nodeType?: string
  assetKind?: AssetKind
  allowUpload?: boolean
  uploadFolder?: ResultItemType
  uploadSubfolder?: string
  isAssetMode?: boolean
  defaultLayoutMode?: LayoutMode
}

const {
  widget,
  nodeType,
  assetKind,
  allowUpload = false,
  uploadFolder,
  uploadSubfolder,
  isAssetMode = false,
  defaultLayoutMode = 'grid'
} = defineProps<Props>()

provide(
  AssetKindKey,
  computed(() => assetKind)
)

const modelValue = defineModel<string | undefined>({
  default(props: Props) {
    const values = props.widget.options?.values
    return (Array.isArray(values) ? values[0] : undefined) ?? ''
  }
})

const { t } = useI18n()
const toastStore = useToastStore()

const outputMediaAssets = useMediaAssets('output')

const transformCompatProps = useTransformCompatOverlayProps()

const combinedProps = computed(() => ({
  ...filterWidgetProps(widget.options, PANEL_EXCLUDED_PROPS),
  ...transformCompatProps.value
}))

const getAssetData = () => {
  const resolvedNodeType = widget.options?.nodeType ?? nodeType
  if (isAssetMode && resolvedNodeType) {
    return useAssetWidgetData(toRef(resolvedNodeType))
  }
  return null
}
const assetData = getAssetData()

const filterSelected = ref('all')
const filterOptions = computed<FilterOption[]>(() => {
  if (isAssetMode) {
    const categoryName = assetData?.category.value ?? 'All'
    return [{ name: capitalize(categoryName), value: 'all' }]
  }
  return [
    { name: 'All', value: 'all' },
    { name: 'Inputs', value: 'inputs' },
    { name: 'Outputs', value: 'outputs' }
  ]
})

const ownershipSelected = ref<OwnershipOption>('all')
const showOwnershipFilter = computed(() => isAssetMode)

const { ownershipOptions, availableBaseModels } = useAssetFilterOptions(
  () => assetData?.assets.value ?? []
)

const baseModelSelected = ref<Set<string>>(new Set())
const showBaseModelFilter = computed(() => isAssetMode)
const baseModelOptions = computed<FilterOption[]>(() => {
  if (!isAssetMode || !assetData) return []
  return availableBaseModels.value
})

const selectedSet = ref<Set<string>>(new Set())

function getDisplayLabel(value: string): string {
  const getOptionLabel = widget.options?.getOptionLabel
  if (!getOptionLabel) return value

  try {
    return getOptionLabel(value) || value
  } catch (e) {
    console.error('Failed to map value:', e)
    return value
  }
}

const inputItems = computed<FormDropdownItem[]>(() => {
  const values = widget.options?.values || []

  if (!Array.isArray(values)) {
    return []
  }

  return values.map((value, index) => ({
    id: `input-${index}`,
    preview_url: getMediaUrl(String(value), 'input'),
    name: String(value),
    label: getDisplayLabel(String(value))
  }))
})
function assetKindToMediaType(kind: AssetKind): string {
  return kind === 'mesh' ? '3D' : kind
}

const outputItems = computed<FormDropdownItem[]>(() => {
  if (!['image', 'video', 'audio', 'mesh'].includes(assetKind ?? '')) return []

  const targetMediaType = assetKindToMediaType(assetKind!)
  const outputFiles = outputMediaAssets.media.value.filter(
    (asset) => getMediaTypeFromFilename(asset.name) === targetMediaType
  )

  return outputFiles.map((asset) => {
    const annotatedPath = `${asset.name} [output]`
    return {
      id: `output-${annotatedPath}`,
      preview_url: asset.preview_url || getMediaUrl(asset.name, 'output'),
      name: annotatedPath,
      label: getDisplayLabel(annotatedPath)
    }
  })
})

const missingValueItem = computed<FormDropdownItem | undefined>(() => {
  const currentValue = modelValue.value
  if (!currentValue) return undefined

  if (isAssetMode && assetData) {
    const existsInAssets = assetData.assets.value.some(
      (asset) => getAssetFilename(asset) === currentValue
    )
    if (existsInAssets) return undefined

    return {
      id: `missing-${currentValue}`,
      preview_url: '',
      name: currentValue,
      label: getDisplayLabel(currentValue)
    }
  }

  const existsInInputs = inputItems.value.some(
    (item) => item.name === currentValue
  )
  const existsInOutputs = outputItems.value.some(
    (item) => item.name === currentValue
  )

  if (existsInInputs || existsInOutputs) return undefined

  const isOutput = currentValue.endsWith(' [output]')
  const strippedValue = isOutput
    ? currentValue.replace(' [output]', '')
    : currentValue

  return {
    id: `missing-${currentValue}`,
    preview_url: getMediaUrl(strippedValue, isOutput ? 'output' : 'input'),
    name: currentValue,
    label: getDisplayLabel(currentValue)
  }
})

const assetItems = computed<FormDropdownItem[]>(() => {
  if (!isAssetMode || !assetData) return []
  return assetData.assets.value.map((asset) => ({
    id: asset.id,
    name: getAssetFilename(asset),
    label: getAssetDisplayName(asset),
    preview_url: asset.preview_url,
    is_immutable: asset.is_immutable,
    base_models: getAssetBaseModels(asset)
  }))
})

const ownershipFilteredAssetItems = computed<FormDropdownItem[]>(() =>
  filterItemByOwnership(assetItems.value, ownershipSelected.value)
)

const baseModelFilteredAssetItems = computed<FormDropdownItem[]>(() =>
  filterItemByBaseModels(
    ownershipFilteredAssetItems.value,
    baseModelSelected.value
  )
)

const allItems = computed<FormDropdownItem[]>(() => {
  if (isAssetMode && assetData) {
    return baseModelFilteredAssetItems.value
  }
  return [
    ...(missingValueItem.value ? [missingValueItem.value] : []),
    ...inputItems.value,
    ...outputItems.value
  ]
})

const dropdownItems = computed<FormDropdownItem[]>(() => {
  if (isAssetMode) {
    return allItems.value
  }

  switch (filterSelected.value) {
    case 'inputs':
      return inputItems.value
    case 'outputs':
      return outputItems.value
    case 'all':
    default:
      return allItems.value
  }
})

/**
 * Items used for display in the input field. In cloud mode, includes
 * missing items so users can see their selected value even if not in library.
 */
const displayItems = computed<FormDropdownItem[]>(() => {
  if (isAssetMode && assetData && missingValueItem.value) {
    return [missingValueItem.value, ...baseModelFilteredAssetItems.value]
  }
  return dropdownItems.value
})

const mediaPlaceholder = computed(() => {
  const options = widget.options

  if (options?.placeholder) {
    return options.placeholder
  }

  switch (assetKind) {
    case 'image':
      return t('widgets.uploadSelect.placeholderImage')
    case 'video':
      return t('widgets.uploadSelect.placeholderVideo')
    case 'audio':
      return t('widgets.uploadSelect.placeholderAudio')
    case 'mesh':
      return t('widgets.uploadSelect.placeholderMesh')
    case 'model':
      return t('widgets.uploadSelect.placeholderModel')
    case 'unknown':
      return t('widgets.uploadSelect.placeholderUnknown')
  }

  return t('widgets.uploadSelect.placeholder')
})

const uploadable = computed(() => {
  if (isAssetMode) return false
  return allowUpload
})

const acceptTypes = computed(() => {
  switch (assetKind) {
    case 'image':
      return 'image/*'
    case 'video':
      return 'video/*'
    case 'audio':
      return 'audio/*'
    case 'mesh':
      return SUPPORTED_EXTENSIONS_ACCEPT
    default:
      return undefined // model or unknown
  }
})

const layoutMode = ref<LayoutMode>(defaultLayoutMode)

watch(
  [modelValue, displayItems],
  ([currentValue]) => {
    if (currentValue === undefined) {
      selectedSet.value.clear()
      return
    }

    const item = displayItems.value.find((item) => item.name === currentValue)
    if (!item) {
      selectedSet.value.clear()
      return
    }
    selectedSet.value.clear()
    selectedSet.value.add(item.id)
  },
  { immediate: true }
)

function updateSelectedItems(selectedItems: Set<string>) {
  let id: string | undefined = undefined
  if (selectedItems.size > 0) {
    id = selectedItems.values().next().value!
  }
  if (id == null) {
    modelValue.value = undefined
    return
  }
  const name = dropdownItems.value.find((item) => item.id === id)?.name
  if (!name) {
    modelValue.value = undefined
    return
  }
  modelValue.value = name
  useWorkflowStore().activeWorkflow?.changeTracker?.checkState()
}

const assetsStore = useAssetsStore()
const { loading: uploading, uploadBatch } = useUpload()

const uploadFiles = async (files: File[]): Promise<string[]> => {
  const folder = uploadFolder ?? 'input'

  const results = await uploadBatch(
    files.map((file) => ({ source: file })),
    { type: folder, subfolder: uploadSubfolder }
  )

  const failedUploads = results.filter((r) => !r.success)
  for (const failed of failedUploads) {
    if (failed.error === UPLOAD_SKIPPED_ERROR) {
      toastStore.addAlert(t('g.uploadAlreadyInProgress'))
    } else {
      toastStore.addAlert(failed.error || t('toastMessages.uploadFailed'))
    }
  }

  const successfulPaths = results.filter((r) => r.success).map((r) => r.path)

  if (folder === 'input' && successfulPaths.length > 0) {
    await assetsStore.updateInputs()
  }

  return successfulPaths
}

async function handleFilesUpdate(files: File[]) {
  if (!files || files.length === 0) return

  try {
    const uploadedPaths = await uploadFiles(files)

    if (uploadedPaths.length === 0) {
      return
    }

    const values = widget.options?.values
    if (Array.isArray(values)) {
      uploadedPaths.forEach((path) => {
        if (!values.includes(path)) {
          values.push(path)
        }
      })
    }

    modelValue.value = uploadedPaths[0]

    if (widget.callback) {
      widget.callback(uploadedPaths[0])
    }

    useWorkflowStore().activeWorkflow?.changeTracker?.checkState()
  } catch (error) {
    console.error('Upload error:', error)
    toastStore.addAlert(`Upload failed: ${error}`)
  }
}

function getMediaUrl(
  filename: string,
  type: 'input' | 'output' = 'input'
): string {
  if (!['image', 'video', 'audio', 'mesh'].includes(assetKind ?? '')) return ''
  const params = new URLSearchParams({ filename, type })
  appendCloudResParam(params, filename)
  return `/api/view?${params}`
}

function handleIsOpenUpdate(isOpen: boolean) {
  if (isOpen && !outputMediaAssets.loading.value) {
    void outputMediaAssets.refresh()
  }
}
</script>

<template>
  <WidgetLayoutField :widget>
    <FormDropdown
      v-model:selected="selectedSet"
      v-model:filter-selected="filterSelected"
      v-model:layout-mode="layoutMode"
      v-model:ownership-selected="ownershipSelected"
      v-model:base-model-selected="baseModelSelected"
      :items="dropdownItems"
      :display-items="displayItems"
      :placeholder="mediaPlaceholder"
      :multiple="false"
      :uploadable
      :loading="uploading"
      :accept="acceptTypes"
      :filter-options
      :show-ownership-filter
      :ownership-options
      :show-base-model-filter
      :base-model-options
      v-bind="combinedProps"
      class="w-full"
      @update:selected="updateSelectedItems"
      @update:files="handleFilesUpdate"
      @update:is-open="handleIsOpenUpdate"
    />
  </WidgetLayoutField>
</template>
