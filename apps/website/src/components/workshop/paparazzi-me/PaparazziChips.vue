<script setup lang="ts">
import type { PaparazziMe } from '@/composables/usePaparazziMe'
import type { Locale } from '@/i18n/translations'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import EditorChip from '@/components/workshop/app-editor/EditorChip.vue'
import EditorDivider from '@/components/workshop/app-editor/EditorDivider.vue'
import PaparazziResolution from './PaparazziResolution.vue'
import PaparazziRun from './PaparazziRun.vue'
import { PAPARAZZI_SECTIONS, sectionMeta } from './sections'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { tray, phase } = paparazzi
</script>

<template>
  <EditorChip
    v-for="section in PAPARAZZI_SECTIONS"
    :key="section.id"
    :label="pc(section.title, locale)"
    :value="sectionMeta(section.id, paparazzi, locale)"
    :expanded="tray === section.id"
    :disabled="phase.kind === 'running'"
    compact
    @click="paparazzi.toggleTray(section.id)"
  />
  <PaparazziResolution :paparazzi :locale composer />
  <EditorDivider class="max-sm:hidden" />
  <PaparazziRun :paparazzi :locale />
</template>
