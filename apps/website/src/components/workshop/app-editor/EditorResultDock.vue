<script setup lang="ts">
import { ChevronLeft, Columns2, Download, Image, RefreshCw } from '@lucide/vue'

import EditorDivider from './EditorDivider.vue'
import EditorTool from './EditorTool.vue'
import type { EditorView } from './view'

const { href, fileName, labels } = defineProps<{
  href: string
  fileName: string
  labels: Record<EditorView | 'edit' | 'again' | 'download', string>
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
  <EditorDivider />
  <a
    :href
    :download="fileName"
    class="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary-comfy-yellow px-3.5 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
  >
    <Download class="size-3.5" aria-hidden="true" />
    {{ labels.download }}
  </a>
</template>
