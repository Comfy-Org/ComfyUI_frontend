<script setup lang="ts">
import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import EditorChip from '../app-editor/EditorChip.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import HandSwapResolution from './HandSwapResolution.vue'
import HandSwapRun from './HandSwapRun.vue'
import { SWAP_SECTIONS, sectionMeta } from './sections'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { tray, phase } = swap
const chips = SWAP_SECTIONS.filter(({ id }) => id !== 'resolution')
</script>

<template>
  <EditorChip
    v-for="section in chips"
    :key="section.id"
    :label="hc(section.title, locale)"
    :value="sectionMeta(section.id, swap)"
    :expanded="tray === section.id"
    :disabled="phase.kind === 'running'"
    compact
    @click="swap.toggleTray(section.id)"
  />
  <HandSwapResolution :swap :locale composer />
  <EditorDivider class="max-sm:hidden" />
  <HandSwapRun :swap :locale />
</template>
