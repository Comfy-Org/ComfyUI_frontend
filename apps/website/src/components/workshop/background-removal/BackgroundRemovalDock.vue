<script setup lang="ts">
import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { brc } from '../../../lib/workshop/background-removal/copy'
import EditorChip from '../app-editor/EditorChip.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import BackgroundRemovalFormat from './BackgroundRemovalFormat.vue'
import BackgroundRemovalRun from './BackgroundRemovalRun.vue'
import { CUTOUT_SECTIONS, sectionMeta } from './sections'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { tray, phase } = cutout
</script>

<template>
  <EditorChip
    v-for="section in CUTOUT_SECTIONS.filter(({ id }) => id !== 'format')"
    :key="section.id"
    :label="brc(section.title, locale)"
    :value="sectionMeta(section.id, cutout, locale)"
    :expanded="tray === section.id"
    :disabled="phase.kind === 'running'"
    compact
    @click="cutout.toggleTray(section.id)"
  />
  <BackgroundRemovalFormat :cutout :locale composer />
  <EditorDivider class="max-sm:hidden" />
  <BackgroundRemovalRun :cutout :locale />
</template>
