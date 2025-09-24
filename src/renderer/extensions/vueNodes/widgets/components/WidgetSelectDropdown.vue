<template>
  <WidgetLayoutField :widget>
    <FormDropdown
      v-model:selected="selectedSet"
      :items="dropdownItems"
      :placeholder="mediaPlaceholder"
      :multiple="false"
      v-bind="combinedProps"
      class="w-full"
      @update:selected="updateSelectedItems"
      @update:files="handleFilesUpdate"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ResultItemType } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import FormDropdown from './form/dropdown/FormDropdown.vue'
import type { DropdownItem } from './form/dropdown/types'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  modelValue: string | number | undefined
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
}>()

const { localValue, onChange } = useWidgetValue({
  widget: props.widget,
  modelValue: props.modelValue,
  defaultValue: props.widget.options?.values?.[0] || '',
  emit
})

const transformCompatProps = useTransformCompatOverlayProps()

const combinedProps = computed(() => ({
  ...filterWidgetProps(props.widget.options, PANEL_EXCLUDED_PROPS),
  ...transformCompatProps.value
}))

// Media dropdown specific logic
const selectedSet = ref<Set<number>>(new Set())
const dropdownItems = computed<DropdownItem[]>(() => {
  const values = props.widget.options?.values || []

  if (!Array.isArray(values)) {
    return []
  }

  return values.map((value: string, index: number) => ({
    id: index,
    imageSrc: getMediaUrl(value),
    name: value,
    metadata: ''
  }))
})

const mediaPlaceholder = computed(() => {
  const options = props.widget.options

  // Use widget-provided placeholder if available
  if (options?.placeholder) {
    return options.placeholder
  }

  // Generate placeholder based on media type
  if (options?.image_upload) return 'Select image...'
  if (options?.video_upload) return 'Select video...'
  if (options?.audio_upload) return 'Select audio...'

  // Generic fallback
  return 'Select media...'
})

watch(
  localValue,
  (currentValue) => {
    if (currentValue !== undefined) {
      const index = dropdownItems.value.findIndex(
        (item) => item.name === currentValue
      )
      if (index >= 0) {
        selectedSet.value.clear()
        selectedSet.value.add(index)
      }
    } else {
      selectedSet.value.clear()
    }
  },
  { immediate: true }
)

function updateSelectedItems(selectedItems: Set<number>) {
  let index: number | undefined = undefined
  if (selectedItems.size > 0) {
    index = selectedItems.values().next().value!
  }
  if (index != null) {
    onChange(dropdownItems.value[index].name)
  } else {
    onChange(undefined)
  }
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
    useToastStore().addAlert(resp.status + ' - ' + resp.statusText)
    return null
  }

  const data = await resp.json()
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name
}

// Handle multiple file uploads
const uploadFiles = async (files: File[]): Promise<string[]> => {
  const uploadPromises = files.map((file) =>
    uploadFile(file, false, { type: 'input' })
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
      useToastStore().addAlert('File upload failed')
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
    useToastStore().addAlert(`Upload failed: ${error}`)
  }
}

function getMediaUrl(filename: string): string {
  // TODO: This needs to be adapted based on actual ComfyUI API structure
  return `/api/view?filename=${encodeURIComponent(filename)}&type=input`
}
</script>
