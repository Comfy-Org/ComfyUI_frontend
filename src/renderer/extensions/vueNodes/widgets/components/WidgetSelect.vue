<template>
  <WidgetSelectDropdown
    v-if="isDropdownUIWidget"
    v-bind="props"
    :media-kind="mediaKind"
    :allow-upload="allowUpload"
    :upload-folder="uploadFolder"
    @update:model-value="handleUpdateModelValue"
  />
  <WidgetSelectDefault
    v-else
    v-bind="props"
    @update:model-value="handleUpdateModelValue"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { ResultItemType } from '@/schemas/apiSchema'
import {
  type ComboInputSpec,
  isComboInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import type { MediaKind } from '@/types/widgetTypes'

import WidgetSelectDefault from './WidgetSelectDefault.vue'
import WidgetSelectDropdown from './WidgetSelectDropdown.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  modelValue: string | number | undefined
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
}>()

function handleUpdateModelValue(value: string | number | undefined) {
  emit('update:modelValue', value)
}

const comboSpec = computed<ComboInputSpec | undefined>(() => {
  if (!props.widget.spec) return undefined
  return isComboInputSpec(props.widget.spec) ? props.widget.spec : undefined
})

const specDescriptor = computed(() => {
  const spec = comboSpec.value
  if (!spec) {
    return {
      kind: 'unknown' as MediaKind,
      allowUpload: false,
      folder: undefined as ResultItemType | undefined
    }
  }

  const {
    image_upload,
    animated_image_upload,
    video_upload,
    widgetType,
    image_folder
  } = spec
  const audioUpload = Boolean(
    (spec as Partial<Record<'audio_upload', boolean>>).audio_upload
  )

  let kind: MediaKind = 'unknown'
  if (video_upload) {
    kind = 'video'
  } else if (image_upload || animated_image_upload) {
    kind = 'image'
  } else if (audioUpload) {
    kind = 'audio'
  } else if (widgetType) {
    const normalized = widgetType.toLowerCase()
    if (normalized.includes('model')) {
      kind = 'model'
    } else if (normalized.includes('audio')) {
      kind = 'audio'
    } else if (normalized.includes('image')) {
      kind = 'image'
    } else if (normalized.includes('video')) {
      kind = 'video'
    }
  }

  return {
    kind,
    allowUpload: image_upload === true || animated_image_upload === true,
    folder: image_folder
  }
})

const mediaKind = computed(() => specDescriptor.value.kind)
const isDropdownUIWidget = computed(() => mediaKind.value !== 'unknown')
const allowUpload = computed(() => specDescriptor.value.allowUpload)
const uploadFolder = computed<ResultItemType>(() => {
  return specDescriptor.value.folder ?? 'input'
})
</script>
