<script setup lang="ts">
import { ChevronLeft, Columns2, Download, RefreshCw } from '@lucide/vue'

import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const {
  swap,
  href,
  fileName,
  locale = 'en'
} = defineProps<{
  swap: HandProductSwap
  href: string
  fileName: string
  locale?: Locale
}>()

const { view } = swap
</script>

<template>
  <EditorTool
    :icon="Columns2"
    :label="hc('swap.compare', locale)"
    :pressed="view === 'compare'"
    @click="view = view === 'compare' ? 'result' : 'compare'"
  />
  <EditorDivider />
  <EditorTool
    :icon="ChevronLeft"
    :label="hc('swap.edit', locale)"
    @click="swap.edit"
  />
  <EditorTool
    :icon="RefreshCw"
    :label="hc('swap.again', locale)"
    @click="swap.swap"
  />
  <EditorDivider />
  <a
    :href
    :download="fileName"
    class="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary-comfy-yellow px-3.5 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
  >
    <Download class="size-3.5" aria-hidden="true" />
    {{ hc('swap.download', locale) }}
  </a>
</template>
