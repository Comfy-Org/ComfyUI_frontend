<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { imageFileOf } from '../../../lib/workshop/virtual-try-on/image-transfer'

const { disabled = false } = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ file: [file: File] }>()

const over = ref(false)

function drop(event: DragEvent) {
  over.value = false
  const file = imageFileOf(event.dataTransfer)
  if (file && !disabled) emit('file', file)
}
</script>

<template>
  <div
    :class="
      cn(
        'transition',
        over && !disabled && 'ring-2 ring-primary-comfy-yellow/70'
      )
    "
    @dragenter.prevent="over = true"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent.stop="drop"
  >
    <slot />
  </div>
</template>
