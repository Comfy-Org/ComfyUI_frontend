<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { elapsedLabel } from '../../../lib/workshop/elapsed'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import { PAPARAZZI_RUN_MS } from '../../../lib/workshop/paparazzi-me/mock-run'
import EditorBusy from '../app-editor/EditorBusy.vue'
import EditorHint from '../app-editor/EditorHint.vue'
import PaparazziStage from './PaparazziStage.vue'
import { sceneName } from './sections'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { setup, phase, search, touched } = paparazzi
const now = useNow({ interval: 250 })

/** Where the run is: the look-up, the queue, then a share of the render. */
const busy = computed(() => {
  const current = phase.value
  if (current.kind !== 'running') return undefined
  const elapsed = Math.max(0, now.value.getTime() - current.startedAt)
  const percent = Math.min(99, Math.round((elapsed / PAPARAZZI_RUN_MS) * 100))
  const title =
    search.value.kind === 'searching'
      ? pc('paparazzi.busy.searching', locale)
      : percent < 10
        ? pc('paparazzi.busy.queued', locale)
        : pc('paparazzi.busy.running', locale, { n: percent })
  return {
    title,
    detail: pc('paparazzi.busy.detail', locale, {
      time: elapsedLabel(elapsed),
      name: setup.value.celebrity.trim(),
      scene: sceneName(paparazzi, locale)
    })
  }
})
</script>

<template>
  <PaparazziStage :paparazzi :locale>
    <EditorHint
      v-if="!touched && phase.kind === 'editing'"
      :text="pc('paparazzi.hint', locale)"
    />
    <EditorBusy
      v-if="busy"
      :title="busy.title"
      :detail="busy.detail"
      :cancel-label="pc('paparazzi.cancel', locale)"
      @cancel="paparazzi.cancel"
    />
  </PaparazziStage>
</template>
