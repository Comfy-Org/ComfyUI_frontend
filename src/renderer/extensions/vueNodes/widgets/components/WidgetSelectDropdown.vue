<script setup lang="ts">
import { capitalize } from 'es-toolkit'
import { computed, provide, ref, toRef, watch } from 'vue'

import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import { t } from '@/i18n'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
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
import { api } from '@/scripts/api'
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

const outputMediaAssets = useMediaAssets('output')

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
 * Falls back to the original value if getOptionLabel is not provided or throws an error.
 */
function getDisplayLabel(value: string): string {
  const getOptionLabel = props.widget.options?.getOptionLabel
  if (!getOptionLabel) return value

  try {
    return getOptionLabel(value)
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
  if (!['image', 'video', 'audio'].includes(props.assetKind ?? '')) return []

  // Filter assets by media type using getMediaTypeFromFilename
  const outputFiles = outputMediaAssets.media.value.filter((asset) => {
    const mediaType = getMediaTypeFromFilename(asset.name)
    return toAssertType(mediaType) === props.assetKind
  })

  return outputFiles.map((asset, index) => {
    // Add [output] annotation so the preview component knows the type
    const annotatedPath = `${asset.name} [output]`
    return {
      id: `output-${index}`,
      mediaSrc: asset.preview_url || getMediaUrl(asset.name, 'output'),
      name: annotatedPath,
      label: getDisplayLabel(annotatedPath),
      metadata: ''
    }
  })
})

function toAssertType(
  mediaType: ReturnType<typeof getMediaTypeFromFilename>
): AssetKind {
  switch (mediaType) {
    case 'image':
    case 'video':
    case 'audio':
      return mediaType
    case '3D':
      return 'model'
    default:
      return 'unknown'
  }
}

const allItems = computed<DropdownItem[]>(() => {
  if (props.isAssetMode && assetData) {
    return assetData.dropdownItems.value
  }
  return [...inputItems.value, ...outputItems.value]
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
      return [...inputItems.value, ...outputItems.value]
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

// Upload file function (copied from useNodeImageUpload.ts)
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

// Handle multiple file uploads
const uploadFiles = async (files: File[]): Promise<string[]> => {
  const folder = props.uploadFolder ?? 'input'
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

function handleIsOpenUpdate(isOpen: boolean) {
  if (isOpen && !outputMediaAssets.loading) {
    outputMediaAssets.refresh()
  }
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
      @update:is-open="handleIsOpenUpdate"
    />
  </WidgetLayoutField>
</template>
