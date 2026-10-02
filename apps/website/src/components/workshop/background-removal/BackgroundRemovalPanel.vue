<script setup lang="ts">
import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { brc } from '../../../lib/workshop/background-removal/copy'
import EditorCollapsible from '../app-editor/EditorCollapsible.vue'
import EditorPanelRow from '../app-editor/EditorPanelRow.vue'
import BackgroundRemovalFormat from './BackgroundRemovalFormat.vue'
import BackgroundRemovalSeed from './BackgroundRemovalSeed.vue'
import { CUTOUT_SECTIONS, sectionMeta } from './sections'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { phase } = cutout
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="min-w-0"
    data-testid="background-removal-panel"
  >
    <template v-for="section in CUTOUT_SECTIONS" :key="section.id">
      <EditorPanelRow v-if="section.id === 'format'">
        <BackgroundRemovalFormat :cutout :locale />
        <BackgroundRemovalSeed :cutout :locale />
      </EditorPanelRow>
      <EditorCollapsible
        v-else
        :title="brc(section.title, locale)"
        :meta="sectionMeta(section.id, cutout, locale)"
        :initially-open="section.open"
      >
        <component :is="section.content" :cutout :locale />
      </EditorCollapsible>
    </template>
  </fieldset>
</template>
