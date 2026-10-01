<script setup lang="ts">
import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import type { SwapImage } from '../../../lib/workshop/hand-product-swap/examples'
import EditorCollapsible from '../app-editor/EditorCollapsible.vue'
import HandSwapHandRow from './HandSwapHandRow.vue'
import { SWAP_SECTIONS, sectionMeta } from './sections'

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
      v-for="section in SWAP_SECTIONS"
      :key="section.id"
      :title="hc(section.title, locale)"
      :meta="sectionMeta(section.id, swap, locale)"
      :initially-open="section.open"
    >
      <component :is="section.content" :swap :locale />
    </EditorCollapsible>
  </fieldset>
</template>
