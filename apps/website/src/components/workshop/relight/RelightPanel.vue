<script setup lang="ts">
import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorCollapsible from '../app-editor/EditorCollapsible.vue'
import { RELIGHT_SECTIONS } from './sections'

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
      :initially-open="section.open"
    >
      <component :is="section.content" :relight :locale />
    </EditorCollapsible>
  </fieldset>
</template>
