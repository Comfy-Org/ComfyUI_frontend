<script setup lang="ts">
import { ChevronLeft, Columns2, Download, RefreshCw } from '@lucide/vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import type { PaparazziResult } from '../../../lib/workshop/paparazzi-me/contract'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const {
  paparazzi,
  result,
  locale = 'en'
} = defineProps<{
  paparazzi: PaparazziMe
  result: PaparazziResult
  locale?: Locale
}>()

const { compare } = paparazzi
</script>

<template>
  <EditorTool
    :icon="Columns2"
    :label="pc('paparazzi.view.compare', locale)"
    :pressed="compare"
    @click="compare = !compare"
  />
  <EditorDivider />
  <EditorTool
    :icon="ChevronLeft"
    :label="pc('paparazzi.edit', locale)"
    @click="paparazzi.edit"
  />
  <EditorTool
    :icon="RefreshCw"
    :label="pc('paparazzi.again', locale)"
    @click="paparazzi.retry"
  />
  <EditorDivider />
  <a
    :href="result.url"
    :download="`paparazzi-me-${result.seed}.jpg`"
    class="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary-comfy-yellow px-3.5 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
  >
    <Download class="size-3.5" aria-hidden="true" />
    {{ pc('paparazzi.download', locale) }}
  </a>
</template>
