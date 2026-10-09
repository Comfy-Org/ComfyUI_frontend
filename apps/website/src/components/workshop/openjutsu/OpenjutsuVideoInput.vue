<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

/** A video picker: the slot is the label, and a video dropped on it counts too. */
const { label } = defineProps<{
  /** Names the picker for screen readers when the slot is not text. */
  label?: string
}>()

const emit = defineEmits<{ file: [file: File] }>()

const over = ref(false)

function choose(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('file', file)
}

function dropped(event: DragEvent) {
  over.value = false
  const file = event.dataTransfer?.files[0]
  if (file?.type.startsWith('video/')) emit('file', file)
}
</script>

<template>
  <label
    :class="
      cn(
        'cursor-pointer transition focus-within:ring-3 focus-within:ring-primary-comfy-yellow/50',
        over && 'ring-2 ring-primary-comfy-yellow/70'
      )
    "
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent.stop="dropped"
  >
    <slot />
    <input
      type="file"
      accept="video/*"
      class="sr-only"
      :aria-label="label"
      @change="choose"
    />
  </label>
</template>
