<script setup lang="ts">
import { ChevronLeft, Columns2, RefreshCw } from '@lucide/vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
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
</template>
