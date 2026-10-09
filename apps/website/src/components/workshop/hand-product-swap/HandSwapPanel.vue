<script setup lang="ts">
import type { HandProductSwap } from '@/composables/useHandProductSwap'
import type { Locale } from '@/i18n/translations'
import { hc } from '@/lib/workshop/hand-product-swap/copy'
import type { SwapImage } from '@/lib/workshop/hand-product-swap/examples'
import EditorCollapsible from '@/components/workshop/app-editor/EditorCollapsible.vue'
import EditorPanelRow from '@/components/workshop/app-editor/EditorPanelRow.vue'
import HandSwapHandRow from './HandSwapHandRow.vue'
import HandSwapProducts from './HandSwapProducts.vue'
import HandSwapResolution from './HandSwapResolution.vue'
import HandSwapSeed from './HandSwapSeed.vue'
import { sectionMeta } from './sections'

const {
  hand,
  swap,
  locale = 'en'
} = defineProps<{
  hand: SwapImage
  swap: HandProductSwap
  locale?: Locale
}>()

const { phase } = swap
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="min-w-0"
    data-testid="swap-panel"
  >
    <HandSwapHandRow :hand :locale @file="swap.useHandFile" />
    <EditorCollapsible
      :title="hc('swap.product', locale)"
      :meta="sectionMeta('product', swap)"
      initially-open
    >
      <HandSwapProducts :swap :locale />
    </EditorCollapsible>
    <EditorPanelRow>
      <HandSwapResolution :swap :locale />
      <HandSwapSeed :swap :locale />
    </EditorPanelRow>
  </fieldset>
</template>
