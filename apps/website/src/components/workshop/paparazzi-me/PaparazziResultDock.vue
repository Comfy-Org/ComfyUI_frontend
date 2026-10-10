<script setup lang="ts">
import { ChevronLeft, RefreshCw } from '@lucide/vue'

import type { PaparazziMe } from '@/composables/usePaparazziMe'
import type { Locale } from '@/i18n/translations'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import EditorCompareToggle from '@/components/workshop/app-editor/EditorCompareToggle.vue'
import EditorDivider from '@/components/workshop/app-editor/EditorDivider.vue'
import EditorTool from '@/components/workshop/app-editor/EditorTool.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { compare } = paparazzi
</script>

<template>
  <EditorCompareToggle
    v-model="compare"
    :label="pc('paparazzi.view.compare', locale)"
    :locale
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
