<script setup lang="ts">
import { Redo2, Undo2 } from '@lucide/vue'

import EditorTool from './EditorTool.vue'

const {
  canUndo,
  canRedo,
  disabled = false,
  labels
} = defineProps<{
  canUndo: boolean
  canRedo: boolean
  disabled?: boolean
  labels: { group: string; undo: string; redo: string }
}>()

const emit = defineEmits<{ undo: []; redo: [] }>()
</script>

<template>
  <div
    role="toolbar"
    :aria-label="labels.group"
    class="flex items-center gap-0.5 rounded-full border border-transparency-white-t20 bg-primary-comfy-ink-light p-1 shadow-lg shadow-black/30"
  >
    <EditorTool
      :icon="Undo2"
      :label="labels.undo"
      icon-only
      :disabled="disabled || !canUndo"
      @click="emit('undo')"
    />
    <EditorTool
      :icon="Redo2"
      :label="labels.redo"
      icon-only
      :disabled="disabled || !canRedo"
      @click="emit('redo')"
    />
  </div>
</template>
