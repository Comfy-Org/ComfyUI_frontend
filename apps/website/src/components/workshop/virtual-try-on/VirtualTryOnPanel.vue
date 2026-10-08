<script setup lang="ts">
import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorCollapsible from '../app-editor/EditorCollapsible.vue'
import EditorPanelRow from '../app-editor/EditorPanelRow.vue'
import VirtualTryOnFit from './VirtualTryOnFit.vue'
import VirtualTryOnGarments from './VirtualTryOnGarments.vue'
import VirtualTryOnPersonRow from './VirtualTryOnPersonRow.vue'
import VirtualTryOnSeed from './VirtualTryOnSeed.vue'
import { sectionMeta } from './sections'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { phase } = tryOn
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="min-w-0"
    data-testid="try-on-panel"
  >
    <VirtualTryOnPersonRow :try-on :locale />
    <EditorCollapsible
      :title="vc('tryOn.garment', locale)"
      :meta="sectionMeta('garment', tryOn, locale)"
      initially-open
    >
      <VirtualTryOnGarments :try-on :locale />
    </EditorCollapsible>
    <EditorPanelRow>
      <VirtualTryOnFit :try-on :locale />
    </EditorPanelRow>
    <EditorPanelRow>
      <VirtualTryOnSeed :try-on :locale />
    </EditorPanelRow>
  </fieldset>
</template>
