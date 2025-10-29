<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
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

import FormDropdown from './form/dropdown/FormDropdown.vue'
import { AssetKindKey } from './form/dropdown/types'
import type {
  DropdownItem,
  FilterOption,
  SelectedKey
} from './form/dropdown/types'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  modelValue: string | number | undefined
  assetKind?: AssetKind
  allowUpload?: boolean
  uploadFolder?: ResultItemType
}>()

provide(
  AssetKindKey,
  computed(() => props.assetKind)
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
}>()

const { localValue, onChange } = useWidgetValue({
  widget: props.widget,
  modelValue: props.modelValue,
  defaultValue: props.widget.options?.values?.[0] || '',
  emit
})

const toastStore = useToastStore()
const queueStore = useQueueStore()

const transformCompatProps = useTransformCompatOverlayProps()

const combinedProps = computed(() => ({
  ...filterWidgetProps(props.widget.options, PANEL_EXCLUDED_PROPS),
  ...transformCompatProps.value
}))

const filterSelected = ref('all')
const filterOptions = ref<FilterOption[]>([
  { id: 'all', name: 'All' },
  { id: 'inputs', name: 'Inputs' },
  { id: 'outputs', name: 'Outputs' }
])

const selectedSet = ref<Set<SelectedKey>>(new Set())
const inputItems = computed<DropdownItem[]>(() => {
  const values = props.widget.options?.values || []

  if (!Array.isArray(values)) {
    return []
  }

  return values.map((value: string, index: number) => ({
    id: `input-${index}`,
    mediaSrc: getMediaUrl(value, 'input'),
    name: value,
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

  return Array.from(outputs).map((output, index) => ({
    id: `output-${index}`,
    mediaSrc: getMediaUrl(output.replace(' [output]', ''), 'output'),
    name: output,
    metadata: ''
  }))
})

const allItems = computed<DropdownItem[]>(() => {
  return [...inputItems.value, ...outputItems.value]
})
const dropdownItems = computed<DropdownItem[]>(() => {
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

const uploadable = computed(() => props.allowUpload === true)

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

watch(
  localValue,
  (currentValue) => {
    if (currentValue !== undefined) {
      const item = dropdownItems.value.find(
        (item) => item.name === currentValue
      )
      if (item) {
        selectedSet.value.clear()
        selectedSet.value.add(item.id)
      }
    } else {
      selectedSet.value.clear()
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
    onChange(undefined)
    return
  }
  const name = dropdownItems.value.find((item) => item.id === id)?.name
  if (!name) {
    onChange(undefined)
    return
  }
  onChange(name)
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
    onChange(uploadedPaths[0])

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
