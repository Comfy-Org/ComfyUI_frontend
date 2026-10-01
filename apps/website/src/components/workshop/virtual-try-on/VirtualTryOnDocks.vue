<script setup lang="ts">
import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import EditorDivider from '../app-editor/EditorDivider.vue'
import VirtualTryOnComposer from './VirtualTryOnComposer.vue'
import VirtualTryOnResultDock from './VirtualTryOnResultDock.vue'
import VirtualTryOnTools from './VirtualTryOnTools.vue'

const {
  tryOn,
  panel,
  locale = 'en'
} = defineProps<{
  tryOn: VirtualTryOn
  /** In the side panel layout the settings live in the panel. */
  panel: boolean
  locale?: Locale
}>()

const { phase } = tryOn
</script>

<template>
  <VirtualTryOnResultDock
    v-if="phase.kind === 'done'"
    :try-on
    :result="phase.result.url"
    :locale
  />
  <VirtualTryOnTools v-else-if="panel" :try-on :locale />
  <template v-else>
    <VirtualTryOnTools :try-on :locale />
    <EditorDivider />
    <VirtualTryOnComposer :try-on :locale />
  </template>
</template>
