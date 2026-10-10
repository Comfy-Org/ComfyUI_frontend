<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { imageFileOf } from './image-transfer'

defineOptions({ inheritAttrs: false })

const {
  label,
  disabled = false,
  inputTestId
} = defineProps<{
  /** Names the button for screen readers when its content is not text. */
  label?: string
  disabled?: boolean
  /** Names the hidden file input, for tests to upload through. */
  inputTestId?: string
}>()

const emit = defineEmits<{ file: [file: File] }>()
const input = useTemplateRef<HTMLInputElement>('input')

function take(data: DataTransfer | null) {
  const file = imageFileOf(data)
  if (file && !disabled) emit('file', file)
}

function onChange(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file?.type.startsWith('image/') && !disabled) emit('file', file)
}
</script>

<template>
  <button
    v-bind="$attrs"
    type="button"
    :aria-label="label"
    :title="label"
    :disabled
    @click="input?.click()"
    @dragover.prevent.stop
    @drop.prevent.stop="take($event.dataTransfer)"
  >
    <slot />
  </button>
  <input
    ref="input"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
    :data-testid="inputTestId"
    @change="onChange"
  />
</template>
