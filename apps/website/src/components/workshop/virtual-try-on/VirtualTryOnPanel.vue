<script setup lang="ts">
import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorCollapsible from '../app-editor/EditorCollapsible.vue'
import EditorPanelRow from '../app-editor/EditorPanelRow.vue'
import VirtualTryOnAdvanced from './VirtualTryOnAdvanced.vue'
import VirtualTryOnPersonRow from './VirtualTryOnPersonRow.vue'
import { TRY_ON_SECTIONS, sectionMeta } from './sections'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { phase } = tryOn
const sections = TRY_ON_SECTIONS.filter(({ id }) => id !== 'advanced')
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="min-w-0"
    data-testid="try-on-panel"
  >
    <VirtualTryOnPersonRow :try-on :locale />
    <EditorCollapsible
      v-for="section in sections"
      :key="section.id"
      :title="vc(section.title, locale)"
      :meta="sectionMeta(section.id, tryOn, locale)"
      :initially-open="section.open"
    >
      <component :is="section.content" :try-on :locale />
    </EditorCollapsible>
    <EditorPanelRow>
      <VirtualTryOnAdvanced :try-on :locale />
    </EditorPanelRow>
  </fieldset>
</template>
