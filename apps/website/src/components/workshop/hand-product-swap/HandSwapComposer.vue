<script setup lang="ts">
import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import EditorChip from '../app-editor/EditorChip.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import HandSwapHistory from './HandSwapHistory.vue'
import HandSwapRun from './HandSwapRun.vue'
import HandSwapTools from './HandSwapTools.vue'
import { SWAP_SECTIONS, sectionMeta } from './sections'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { tray, phase } = swap
</script>

<template>
  <HandSwapTools :swap :locale />
  <EditorDivider />
  <HandSwapHistory :swap :locale />
  <EditorDivider />
  <EditorChip
    v-for="section in SWAP_SECTIONS"
    :key="section.id"
    :label="hc(section.title, locale)"
    :value="sectionMeta(section.id, swap, locale)"
    :expanded="tray === section.id"
    :disabled="phase.kind === 'running'"
    compact
    @click="swap.toggleTray(section.id)"
  />
  <EditorDivider class="max-sm:hidden" />
  <HandSwapRun :swap :locale />
</template>
