<script setup lang="ts">
import { ChevronLeft, Columns2, RefreshCw } from '@lucide/vue'

import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
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
</template>
