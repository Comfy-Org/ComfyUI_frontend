<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { elapsedLabel } from '../../../lib/workshop/elapsed'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import EditorBusy from '../app-editor/EditorBusy.vue'
import EditorHint from '../app-editor/EditorHint.vue'
import PaparazziFaceCard from './PaparazziFaceCard.vue'
import PaparazziStage from './PaparazziStage.vue'
import { sceneName } from './sections'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { setup, phase, touched } = paparazzi
const now = useNow({ interval: 1000 })
const detail = computed(() =>
  phase.value.kind === 'running'
    ? pc('paparazzi.busy.detail', locale, {
        time: elapsedLabel(now.value.getTime() - phase.value.startedAt),
        name: setup.value.celebrity.trim(),
        scene: sceneName(setup.value, locale)
      })
    : ''
)
</script>

<template>
  <PaparazziStage :paparazzi :running="phase.kind === 'running'" :locale>
    <PaparazziFaceCard
      :paparazzi
      :disabled="phase.kind === 'running'"
      :locale
    />
    <EditorHint
      v-if="!touched && phase.kind === 'editing'"
      :text="pc('paparazzi.hint', locale)"
    />
    <EditorBusy
      v-if="phase.kind === 'running'"
      :title="pc('paparazzi.busy.title', locale)"
      :detail
      :cancel-label="pc('paparazzi.cancel', locale)"
      @cancel="paparazzi.cancel"
    />
  </PaparazziStage>
</template>
