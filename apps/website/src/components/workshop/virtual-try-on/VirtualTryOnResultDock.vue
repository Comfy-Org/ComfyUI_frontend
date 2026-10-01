<script setup lang="ts">
import { ChevronLeft, Columns2, Download, RefreshCw } from '@lucide/vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const {
  tryOn,
  result,
  locale = 'en'
} = defineProps<{
  tryOn: VirtualTryOn
  result: string
  locale?: Locale
}>()

const { view, person } = tryOn
</script>

<template>
  <EditorTool
    :icon="Columns2"
    :label="vc('tryOn.view.compare', locale)"
    :pressed="view === 'compare'"
    @click="view = view === 'compare' ? 'result' : 'compare'"
  />
  <EditorDivider />
  <EditorTool
    :icon="ChevronLeft"
    :label="vc('tryOn.edit', locale)"
    @click="tryOn.edit"
  />
  <EditorTool
    :icon="RefreshCw"
    :label="vc('tryOn.again', locale)"
    @click="tryOn.tryOn"
  />
  <EditorDivider />
  <a
    :href="result"
    :download="`try-on-${person.name}`"
    class="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary-comfy-yellow px-3.5 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
  >
    <Download class="size-3.5" aria-hidden="true" />
    {{ vc('tryOn.download', locale) }}
  </a>
</template>
