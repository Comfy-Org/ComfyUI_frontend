<script setup lang="ts">
import { ChevronLeft, Columns2, Image, RefreshCw } from '@lucide/vue'

import EditorDivider from './EditorDivider.vue'
import EditorTool from './EditorTool.vue'
import type { EditorView } from './view'

const { labels } = defineProps<{
  labels: Record<EditorView | 'edit' | 'again', string>
}>()

const view = defineModel<EditorView>('view', { required: true })
const emit = defineEmits<{ edit: []; again: [] }>()

const VIEWS = [
  { id: 'compare', icon: Columns2 },
  { id: 'result', icon: Image },
  { id: 'original', icon: Image }
] as const
</script>

<template>
  <EditorTool
    v-for="option in VIEWS"
    :key="option.id"
    :icon="option.icon"
    :label="labels[option.id]"
    :pressed="view === option.id"
    @click="view = option.id"
  />
  <EditorDivider />
  <EditorTool :icon="ChevronLeft" :label="labels.edit" @click="emit('edit')" />
  <EditorTool :icon="RefreshCw" :label="labels.again" @click="emit('again')" />
</template>
