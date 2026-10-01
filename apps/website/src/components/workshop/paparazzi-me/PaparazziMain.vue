<script setup lang="ts">
import { computed } from 'vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import { PAPARAZZI_EXAMPLE } from '../../../lib/workshop/paparazzi-me/mock-run'
import { outputSize } from '../../../lib/workshop/paparazzi-me/setup'
import EditorResult from '../app-editor/EditorResult.vue'
import PaparazziWorkspace from './PaparazziWorkspace.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { face, setup, phase, compare } = paparazzi
const size = computed(() => outputSize(setup.value.resolution))
const labels = computed(() => ({
  resultAlt: pc('paparazzi.alt.result', locale, {
    name: setup.value.celebrity.trim()
  }),
  originalAlt:
    face.value?.url === PAPARAZZI_EXAMPLE.url
      ? pc('paparazzi.face.alt.example', locale)
      : (face.value?.name ?? ''),
  original: pc('paparazzi.view.original', locale),
  result: pc('paparazzi.view.result', locale),
  slider: pc('paparazzi.compare', locale)
}))
</script>

<template>
  <EditorResult
    v-if="face && phase.kind === 'done'"
    :before="face.url"
    :after="phase.result.url"
    :view="compare ? 'compare' : 'result'"
    :width="size.width"
    :height="size.height"
    :labels
    data-testid="paparazzi-result"
  />
  <PaparazziWorkspace v-else :paparazzi :locale />
</template>
