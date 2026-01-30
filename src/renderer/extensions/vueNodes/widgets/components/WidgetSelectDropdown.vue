<script setup lang="ts">
import { capitalize } from 'es-toolkit'
import { computed, provide, ref, toRef, watch } from 'vue'

import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import { t } from '@/i18n'
import { uploadMediaBatch } from '@/platform/assets/services/uploadService'
import { useToastStore } from '@/platform/updates/common/toastStore'
import FormDropdown from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdown.vue'
import { AssetKindKey } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type {
  DropdownItem,
  FilterOption,
  LayoutMode,
  SelectedKey
} from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import WidgetLayoutField from '@/renderer/extensions/vueNodes/widgets/components/layout/WidgetLayoutField.vue'
import { useAssetWidgetData } from '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData'
import type { ResultItemType } from '@/schemas/apiSchema'
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

const props = defineProps<Props>()

provide(
  AssetKindKey,
  computed(() => props.assetKind)
)

const modelValue = defineModel<string | undefined>({
  default(props: Props) {
    return props.widget.options?.values?.[0] || ''
  }
})

const toastStore = useToastStore()
const queueStore = useQueueStore()

const transformCompatProps = useTransformCompatOverlayProps()

const combinedProps = computed(() => ({
  ...filterWidgetProps(props.widget.options, PANEL_EXCLUDED_PROPS),
  ...transformCompatProps.value
}))

const getAssetData = () => {
  const nodeType = props.widget.options?.nodeType ?? props.nodeType
  if (props.isAssetMode && nodeType) {
    return useAssetWidgetData(toRef(nodeType))
  }
  return null
}
const assetData = getAssetData()

const filterSelected = ref('all')
const filterOptions = computed<FilterOption[]>(() => {
  if (props.isAssetMode) {
    const categoryName = assetData?.category.value ?? 'All'
    return [{ id: 'all', name: capitalize(categoryName) }]
  }
  return [
    { id: 'all', name: 'All' },
    { id: 'inputs', name: 'Inputs' },
    { id: 'outputs', name: 'Outputs' }
  ]
})

const selectedSet = ref<Set<SelectedKey>>(new Set())

/**
 * Transforms a value using getOptionLabel if available.
 * Falls back to the original value if getOptionLabel is not provided,
 * returns undefined/null, or throws an error.
 */
function getDisplayLabel(value: string): string {
  const getOptionLabel = props.widget.options?.getOptionLabel
  if (!getOptionLabel) return value

  try {
    return getOptionLabel(value) || value
  } catch (e) {
    console.error('Failed to map value:', e)
    return value
  }
}

const inputItems = computed<DropdownItem[]>(() => {
  const values = props.widget.options?.values || []

  if (!Array.isArray(values)) {
    return []
  }

  return values.map((value: string, index: number) => ({
    id: `input-${index}`,
    mediaSrc: getMediaUrl(value, 'input'),
    name: value,
    label: getDisplayLabel(value),
    metadata: ''
  }))
})
const outputItems = computed<DropdownItem[]>(() => {
  if (!['image', 'video'].includes(props.assetKind ?? '')) return []

  const outputs = new Set<string>()

  // Extract output images/videos from queue history
  queueStore.historyTasks.forEach((task) => {
    task.flatOutputs.forEach((output) => {
      const isTargetType =
        (props.assetKind === 'image' && output.mediaType === 'images') ||
        (props.assetKind === 'video' && output.mediaType === 'video')

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

  return Array.from(outputs).map((output) => ({
    id: `output-${output}`,
    mediaSrc: getMediaUrl(output.replace(' [output]', ''), 'output'),
    name: output,
    label: getDisplayLabel(output),
    metadata: ''
  }))
})

/**
 * Creates a fallback item for the current modelValue when it doesn't exist
 * in the available items list. This handles cases like template-loaded nodes
 * where the saved value may not exist in the current server environment.
 * Works for both local mode (inputItems/outputItems) and cloud mode (assetData).
 */
const missingValueItem = computed<DropdownItem | undefined>(() => {
  const currentValue = modelValue.value
  if (!currentValue) return undefined

  // Check in cloud mode assets
  if (props.isAssetMode && assetData) {
    const existsInAssets = assetData.dropdownItems.value.some(
      (item) => item.name === currentValue
    )
    if (existsInAssets) return undefined

    return {
      id: `missing-${currentValue}`,
      mediaSrc: '',
      name: currentValue,
      label: getDisplayLabel(currentValue),
      metadata: ''
    }
  }

  // Check in local mode inputs/outputs
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
    mediaSrc: getMediaUrl(strippedValue, isOutput ? 'output' : 'input'),
    name: currentValue,
    label: getDisplayLabel(currentValue),
    metadata: ''
  }
})

const allItems = computed<DropdownItem[]>(() => {
  if (props.isAssetMode && assetData) {
    const items = assetData.dropdownItems.value
    if (missingValueItem.value) {
      return [missingValueItem.value, ...items]
    }
    return items
  }
  return [
    ...(missingValueItem.value ? [missingValueItem.value] : []),
    ...inputItems.value,
    ...outputItems.value
  ]
})

const dropdownItems = computed<DropdownItem[]>(() => {
  if (props.isAssetMode) {
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

const mediaPlaceholder = computed(() => {
  const options = props.widget.options

  if (options?.placeholder) {
    return options.placeholder
  }

  switch (props.assetKind) {
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
  if (props.isAssetMode) return false
  return props.allowUpload === true
})

const acceptTypes = computed(() => {
  // Be permissive with accept types because backend uses libraries
  // that can handle a wide range of formats
  switch (props.assetKind) {
    case 'image':
      return 'image/*'
    case 'video':
      return 'video/*'
    case 'audio':
      return 'audio/*'
    default:
      return undefined // model or unknown
  }
})

const layoutMode = ref<LayoutMode>(props.defaultLayoutMode ?? 'grid')

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

function updateSelectedItems(selectedItems: Set<SelectedKey>) {
  let id: SelectedKey | undefined = undefined
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

// Handle multiple file uploads using shared uploadMediaBatch service
const uploadFiles = async (files: File[]): Promise<string[]> => {
  const folder = props.uploadFolder ?? 'input'
  const assetsStore = useAssetsStore()

  const results = await uploadMediaBatch(
    files.map((file) => ({ source: file })),
    { type: folder }
  )

  // Report failed uploads
  const failedUploads = results.filter((r) => !r.success)
  for (const failed of failedUploads) {
    toastStore.addAlert(failed.error || t('toastMessages.uploadFailed'))
  }

  // Update AssetsStore once after all uploads complete (not per-file)
  const successfulPaths = results.filter((r) => r.success).map((r) => r.path)

  if (folder === 'input' && successfulPaths.length > 0) {
    await assetsStore.updateInputs()
  }

  return successfulPaths
}

async function handleFilesUpdate(files: File[]) {
  if (!files || files.length === 0) return

  try {
    // 1. Upload files to server
    const uploadedPaths = await uploadFiles(files)

    if (uploadedPaths.length === 0) {
      toastStore.addAlert(t('toastMessages.uploadFailed'))
      return
    }

    // 2. Update widget options to include new files
    // This simulates what addToComboValues does but for SimplifiedWidget
    if (props.widget.options?.values) {
      uploadedPaths.forEach((path) => {
        const values = props.widget.options!.values as string[]
        if (!values.includes(path)) {
          values.push(path)
        }
      })
    }

    // 3. Update widget value to the first uploaded file
    modelValue.value = uploadedPaths[0]

    // 4. Trigger callback to notify underlying LiteGraph widget
    if (props.widget.callback) {
      props.widget.callback(uploadedPaths[0])
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
  if (!['image', 'video'].includes(props.assetKind ?? '')) return ''
  return `/api/view?filename=${encodeURIComponent(filename)}&type=${type}`
}
</script>

<template>
  <WidgetLayoutField :widget>
    <FormDropdown
      v-model:selected="selectedSet"
      v-model:filter-selected="filterSelected"
      v-model:layout-mode="layoutMode"
      :items="dropdownItems"
      :placeholder="mediaPlaceholder"
      :multiple="false"
      :uploadable="uploadable"
      :accept="acceptTypes"
      :filter-options="filterOptions"
      v-bind="combinedProps"
      class="w-full"
      @update:selected="updateSelectedItems"
      @update:files="handleFilesUpdate"
    />
  </WidgetLayoutField>
</template>
