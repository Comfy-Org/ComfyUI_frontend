<template>
  <WidgetSelectDropdown
    v-if="isDropdownUIWidget"
    v-bind="props"
    :asset-kind="assetKind"
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
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import type { AssetKind } from '@/types/widgetTypes'

import WidgetSelectDefault from './WidgetSelectDefault.vue'
import WidgetSelectDropdown from './WidgetSelectDropdown.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  modelValue: string | number | undefined
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
}>()

function handleUpdateModelValue(value: string | number | undefined) {
  emit('update:modelValue', value)
}

const comboSpec = computed<ComboInputSpec | undefined>(() => {
  if (props.widget.spec && isComboInputSpec(props.widget.spec)) {
    return props.widget.spec
  }
  return undefined
})

const specDescriptor = computed<{
  kind: AssetKind
  allowUpload: boolean
  folder: ResultItemType | undefined
}>(() => {
  const spec = comboSpec.value
  if (!spec) {
    return {
      kind: 'unknown',
      allowUpload: false,
      folder: undefined
    }
  }

  const {
    image_upload,
    animated_image_upload,
    video_upload,
    image_folder,
    audio_upload
  } = spec

  let kind: AssetKind = 'unknown'
  if (video_upload) {
    kind = 'video'
  } else if (image_upload || animated_image_upload) {
    kind = 'image'
  } else if (audio_upload) {
    kind = 'audio'
  }
  // TODO: add support for models (checkpoints, VAE, LoRAs, etc.) -- get widgetType from spec

  const allowUpload =
    image_upload === true ||
    animated_image_upload === true ||
    video_upload === true ||
    audio_upload === true
  return {
    kind,
    allowUpload,
    folder: image_folder
  }
})

const assetKind = computed(() => specDescriptor.value.kind)
const isDropdownUIWidget = computed(() => assetKind.value !== 'unknown')
const allowUpload = computed(() => specDescriptor.value.allowUpload)
const uploadFolder = computed<ResultItemType>(() => {
  return specDescriptor.value.folder ?? 'input'
})
</script>
