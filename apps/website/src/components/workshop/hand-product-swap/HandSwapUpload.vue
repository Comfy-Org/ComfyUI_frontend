<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { firstImage } from '../../../lib/workshop/hand-product-swap/files'

defineOptions({ inheritAttrs: false })

const { label, inputId } = defineProps<{
  label: string
  /** Names the hidden file input, for tests to upload through. */
  inputId: string
}>()
const emit = defineEmits<{ file: [file: File] }>()
const input = useTemplateRef<HTMLInputElement>('input')

function pick(files: FileList | null | undefined) {
  const file = firstImage(files)
  if (file) emit('file', file)
}

function onChange(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  pick(event.target.files)
  event.target.value = ''
}
</script>

<template>
  <button
    v-bind="$attrs"
    type="button"
    :aria-label="label"
    :title="label"
    @click="input?.click()"
    @dragover.prevent.stop
    @drop.prevent.stop="pick($event.dataTransfer?.files)"
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
    :data-testid="inputId"
    @change="onChange"
  />
</template>
