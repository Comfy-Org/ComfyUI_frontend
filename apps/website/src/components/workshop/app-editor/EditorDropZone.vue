<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { imageFileOf } from './image-transfer'

const { disabled = false } = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ file: [file: File] }>()

const over = ref(false)

function hover() {
  over.value = !disabled
}

function leave(event: DragEvent) {
  const zone = event.currentTarget
  const into = event.relatedTarget
  if (zone instanceof Node && into instanceof Node && zone.contains(into))
    return
  over.value = false
}

function drop(event: DragEvent) {
  over.value = false
  const file = imageFileOf(event.dataTransfer)
  if (file && !disabled) emit('file', file)
}
</script>

<template>
  <div
    :class="cn('transition', over && 'ring-2 ring-primary-comfy-yellow/70')"
    :data-drop-over="over || undefined"
    @dragenter.prevent="hover"
    @dragover.prevent="hover"
    @dragleave="leave"
    @drop.prevent.stop="drop"
  >
    <slot />
  </div>
</template>
