<script setup lang="ts">
import { ChevronLeft, Columns2, Download, Image, RefreshCw } from '@lucide/vue'

import type { MoveView } from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import EditorTool from '../app-editor/EditorTool.vue'

const {
  resultUrl,
  fileName,
  locale = 'en'
} = defineProps<{
  resultUrl: string
  fileName: string
  locale?: Locale
}>()

const view = defineModel<MoveView>('view', { required: true })
const emit = defineEmits<{ edit: []; again: [] }>()

const VIEWS = [
  { id: 'compare', icon: Columns2, label: 'move.view.compare' },
  { id: 'result', icon: Image, label: 'move.view.result' },
  { id: 'original', icon: Image, label: 'move.view.original' }
] as const
</script>

<template>
  <EditorTool
    v-for="option in VIEWS"
    :key="option.id"
    :icon="option.icon"
    :label="mc(option.label, locale)"
    :pressed="view === option.id"
    @click="view = option.id"
  />
  <span
    class="mx-1 h-4.5 w-px shrink-0 bg-transparency-white-t20"
    aria-hidden="true"
  />
  <EditorTool
    :icon="ChevronLeft"
    :label="mc('move.edit', locale)"
    @click="emit('edit')"
  />
  <EditorTool
    :icon="RefreshCw"
    :label="mc('move.again', locale)"
    @click="emit('again')"
  />
  <span
    class="mx-1 h-4.5 w-px shrink-0 bg-transparency-white-t20"
    aria-hidden="true"
  />
  <a
    :href="resultUrl"
    :download="`moved-${fileName}`"
    class="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary-comfy-yellow px-3.5 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
  >
    <Download class="size-3.5" aria-hidden="true" />
    {{ mc('move.download', locale) }}
  </a>
</template>
