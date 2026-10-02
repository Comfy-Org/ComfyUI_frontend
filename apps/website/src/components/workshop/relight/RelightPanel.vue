<script setup lang="ts">
import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorCollapsible from '../app-editor/EditorCollapsible.vue'
import EditorPanelRow from '../app-editor/EditorPanelRow.vue'
import RelightSeed from './RelightSeed.vue'
import RelightTools from './RelightTools.vue'
import { RELIGHT_SECTIONS, sectionMeta } from './sections'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { phase } = relight
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="min-w-0"
    data-testid="relight-panel"
  >
    <EditorCollapsible
      v-for="section in RELIGHT_SECTIONS"
      :key="section.id"
      :title="lc(section.title, locale)"
      :meta="sectionMeta(section.id, relight, locale)"
      :initially-open="section.open"
    >
      <template v-if="section.id === 'lights'" #actions>
        <RelightTools :relight :locale compact />
      </template>
      <component :is="section.content" :relight :locale />
    </EditorCollapsible>
    <EditorPanelRow>
      <RelightSeed :relight :locale />
    </EditorPanelRow>
  </fieldset>
</template>
