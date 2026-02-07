<script setup lang="ts">
import { capitalize } from 'es-toolkit'
import { computed, provide, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import { useAssetFilterOptions } from '@/platform/assets/composables/useAssetFilterOptions'
import {
  filterItemByBaseModels,
  filterItemByOwnership
} from '@/platform/assets/utils/assetFilterUtils'
import {
  getAssetBaseModels,
  getAssetDisplayName,
  getAssetFilename
} from '@/platform/assets/utils/assetMetadataUtils'
import { useToastStore } from '@/platform/updates/common/toastStore'
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
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import { useQueueStore } from '@/stores/queueStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import type { AssetKind } from '@/types/widgetTypes'
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
  isAssetMode?: boolean
  defaultLayoutMode?: LayoutMode
}

const {
  widget,
  nodeType,
  assetKind,
  allowUpload,
  uploadFolder,
  isAssetMode,
  defaultLayoutMode
} = defineProps<Props>()

provide(
  AssetKindKey,
  computed(() => assetKind)
)

const modelValue = defineModel<string | undefined>({
  default(props: Props) {
    return props.widget.options?.values?.[0] ?? ''
  }
})

const { t } = useI18n()
const toastStore = useToastStore()
const queueStore = useQueueStore()

const transformCompatProps = useTransformCompatOverlayProps()

const combinedProps = computed(() => ({
  ...filterWidgetProps(widget.options, PANEL_EXCLUDED_PROPS),
  ...transformCompatProps.value
}))

const getAssetData = () => {
  const resolvedNodeType: string | undefined =
    widget.options?.nodeType ?? nodeType
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

/**
 * Transforms a value using getOptionLabel if available.
 * Falls back to the original value if getOptionLabel is not provided,
 * returns undefined/null, or throws an error.
 */
function getDisplayLabel(value: string): string {
  const getOptionLabel = widget.options?.getOptionLabel
  if (!getOptionLabel) return value

  try {
    return getOptionLabel(value) || value
  } catch (error) {
    console.error('Failed to map value:', error)
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
const outputItems = computed<FormDropdownItem[]>(() => {
  if (!['image', 'video'].includes(assetKind ?? '')) return []

  const outputs = new Set<string>()

  // Extract output images/videos from queue history
  queueStore.historyTasks.forEach((task) => {
    task.flatOutputs.forEach((output) => {
      const isTargetType =
        (assetKind === 'image' && output.mediaType === 'images') ||
        (assetKind === 'video' && output.mediaType === 'video')

      if (output.type === 'output' && isTargetType) {
        const path = output.subfolder
          ? `${output.subfolder}/${output.filename}`
          : output.filename
        // Add [output] annotation so the preview component knows the type
        const annotatedPath = `${path} [output]`
        outputs.add(annotatedPath)
      }
    })
  })

  return [...outputs].map((output) => ({
    id: `output-${output}`,
    preview_url: getMediaUrl(output.replace(' [output]', ''), 'output'),
    name: output,
    label: getDisplayLabel(output)
  }))
})

/**
 * Creates a fallback item for the current modelValue when it doesn't exist
 * in the available items list. This handles cases like template-loaded nodes
 * where the saved value may not exist in the current server environment.
 * Works for both local mode (inputItems/outputItems) and cloud mode (assetData).
 */
const missingValueItem = computed<FormDropdownItem | undefined>(() => {
  const currentValue = modelValue.value
  if (!currentValue) return

  // Check in cloud mode assets
  if (isAssetMode && assetData) {
    const existsInAssets = assetData.assets.value.some(
      (asset) => getAssetFilename(asset) === currentValue
    )
    if (existsInAssets) return

    return {
      id: `missing-${currentValue}`,
      preview_url: '',
      name: currentValue,
      label: getDisplayLabel(currentValue)
    }
  }

  // Check in local mode inputs/outputs
  const existsInInputs = inputItems.value.some(
    (item) => item.name === currentValue
  )
  const existsInOutputs = outputItems.value.some(
    (item) => item.name === currentValue
  )

  if (existsInInputs || existsInOutputs) return

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

/**
 * Transforms AssetItem[] to FormDropdownItem[] for cloud mode.
 * Uses getAssetFilename for display name, asset.name for label.
 */
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
    if (missingValueItem.value) {
      return [missingValueItem.value, ...baseModelFilteredAssetItems.value]
    }
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
    default:
      return allItems.value
  }
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
    case 'model':
      return t('widgets.uploadSelect.placeholderModel')
    case 'unknown':
      return t('widgets.uploadSelect.placeholderUnknown')
  }

  return t('widgets.uploadSelect.placeholder')
})

const uploadable = computed(() => {
  if (isAssetMode) return false
  return allowUpload === true
})

const assetKindAcceptTypes: Record<string, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*'
}

const acceptTypes = computed(() =>
  assetKind ? assetKindAcceptTypes[assetKind] : undefined
)

const layoutMode = ref<LayoutMode>(defaultLayoutMode ?? 'grid')

watch(
  [modelValue, dropdownItems],
  ([currentValue, _dropdownItems]) => {
    if (currentValue === undefined) {
      selectedSet.value.clear()
      return
    }

    const item = dropdownItems.value.find((item) => item.name === currentValue)
    if (item) {
      selectedSet.value.clear()
      selectedSet.value.add(item.id)
    }
  },
  { immediate: true }
)

function updateSelectedItems(selectedItems: Set<string>) {
  let id: string | undefined
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
}

const uploadFile = async (
  file: File,
  isPasted: boolean = false,
  formFields: Partial<{ type: ResultItemType }> = {}
) => {
  const body = new FormData()
  body.append('image', file)
  if (isPasted) body.append('subfolder', 'pasted')
  if (formFields.type) body.append('type', formFields.type)

  const resp = await api.fetchApi('/upload/image', {
    method: 'POST',
    body
  })

  if (resp.status !== 200) {
    toastStore.addAlert(resp.status + ' - ' + resp.statusText)
    return null
  }

  const data = await resp.json()

  // Update AssetsStore when uploading to input folder
  if (formFields.type === 'input' || (!formFields.type && !isPasted)) {
    const assetsStore = useAssetsStore()
    await assetsStore.updateInputs()
  }

  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name
}

const uploadFiles = async (files: File[]): Promise<string[]> => {
  const folder = uploadFolder ?? 'input'
  const uploadPromises = files.map((file) =>
    uploadFile(file, false, { type: folder })
  )
  const results = await Promise.all(uploadPromises)
  return results.filter((path): path is string => path !== null)
}

async function handleFilesUpdate(files: File[]) {
  if (!files || files.length === 0) return

  try {
    // 1. Upload files to server
    const uploadedPaths = await uploadFiles(files)

    if (uploadedPaths.length === 0) {
      toastStore.addAlert('File upload failed')
      return
    }

    // 2. Update widget options to include new files
    // This simulates what addToComboValues does but for SimplifiedWidget
    const values = widget.options?.values
    if (Array.isArray(values)) {
      uploadedPaths.forEach((path) => {
        if (!values.includes(path)) {
          values.push(path)
        }
      })
    }

    // 3. Update widget value to the first uploaded file
    modelValue.value = uploadedPaths[0]

    // 4. Trigger callback to notify underlying LiteGraph widget
    if (widget.callback) {
      widget.callback(uploadedPaths[0])
    }
  } catch (error) {
    console.error('Upload error:', error)
    toastStore.addAlert(`Upload failed: ${error}`)
  }
}

function getMediaUrl(
  filename: string,
  type: 'input' | 'output' = 'input'
): string {
  if (!['image', 'video'].includes(assetKind ?? '')) return ''
  return `/api/view?filename=${encodeURIComponent(filename)}&type=${type}`
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
      :placeholder="mediaPlaceholder"
      :multiple="false"
      :uploadable
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
    />
  </WidgetLayoutField>
</template>
