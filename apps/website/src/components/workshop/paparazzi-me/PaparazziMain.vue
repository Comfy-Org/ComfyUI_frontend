<script setup lang="ts">
import { computed } from 'vue'

import type { PaparazziMe } from '@/composables/usePaparazziMe'
import type { Locale } from '@/i18n/translations'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import { outputSize } from '@/lib/workshop/paparazzi-me/setup'
import EditorResult from '@/components/workshop/app-editor/EditorResult.vue'
import PaparazziWorkspace from './PaparazziWorkspace.vue'
import { sceneName } from './sections'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { setup, phase, scene, compare } = paparazzi
const size = computed(() => outputSize(setup.value.resolution))
const before = computed(() => {
  const current = scene.value
  if (!current) return undefined
  return current.kind === 'own'
    ? current.image.url
    : current.candidate.place.url
})
const labels = computed(() => ({
  resultAlt: pc('paparazzi.alt.result', locale, {
    name: setup.value.celebrity.trim()
  }),
  originalAlt: pc('paparazzi.alt.scene', locale, {
    name: setup.value.celebrity.trim(),
    scene: sceneName(paparazzi, locale)
  }),
  original: pc('paparazzi.view.original', locale),
  result: pc('paparazzi.view.result', locale),
  slider: pc('paparazzi.compare', locale)
}))
</script>

<template>
  <EditorResult
    v-if="phase.kind === 'done'"
    :before="before ?? phase.result.url"
    :after="phase.result.url"
    :view="compare && before ? 'compare' : 'result'"
    :width="size.width"
    :height="size.height"
    :labels
    data-testid="paparazzi-result"
  />
  <PaparazziWorkspace v-else :paparazzi :locale />
</template>
