<script setup lang="ts">
import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import EditorPanelRow from '../app-editor/EditorPanelRow.vue'
import PaparazziFaceRow from './PaparazziFaceRow.vue'
import PaparazziResolution from './PaparazziResolution.vue'
import PaparazziSceneRow from './PaparazziSceneRow.vue'
import PaparazziSeed from './PaparazziSeed.vue'
import PaparazziStar from './PaparazziStar.vue'

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
    <PaparazziFaceRow :paparazzi :locale />
    <EditorPanelRow>
      <PaparazziStar :paparazzi :locale />
    </EditorPanelRow>
    <EditorPanelRow>
      <PaparazziSceneRow :paparazzi :locale />
    </EditorPanelRow>
    <EditorPanelRow>
      <PaparazziResolution :paparazzi :locale />
      <PaparazziSeed :paparazzi :locale />
    </EditorPanelRow>
  </fieldset>
</template>
