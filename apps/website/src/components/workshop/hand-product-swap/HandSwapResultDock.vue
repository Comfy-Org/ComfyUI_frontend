<script setup lang="ts">
import { ChevronLeft, RefreshCw } from '@lucide/vue'

import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import EditorCompareToggle from '../app-editor/EditorCompareToggle.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { comparing } = swap
</script>

<template>
  <EditorCompareToggle
    v-model="comparing"
    :label="hc('swap.compare', locale)"
    :locale
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
