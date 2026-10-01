<script setup lang="ts">
import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import EditorCollapsible from '../app-editor/EditorCollapsible.vue'
import { PAPARAZZI_SECTIONS, sectionMeta } from './sections'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { phase } = paparazzi
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="min-w-0"
    data-testid="paparazzi-panel"
  >
    <EditorCollapsible
      v-for="section in PAPARAZZI_SECTIONS"
      :key="section.id"
      :title="pc(section.title, locale)"
      :meta="sectionMeta(section.id, paparazzi, locale)"
      :initially-open="section.open"
    >
      <component :is="section.content" :paparazzi :locale />
    </EditorCollapsible>
  </fieldset>
</template>
