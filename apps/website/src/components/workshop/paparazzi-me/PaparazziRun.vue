<script setup lang="ts">
import { useNow } from '@vueuse/core'

import type { PaparazziMe } from '@/composables/usePaparazziMe'
import type { Locale } from '@/i18n/translations'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import { PAPARAZZI_CREDITS } from '@/lib/workshop/paparazzi-me/mock-run'
import EditorRun from '@/components/workshop/app-editor/EditorRun.vue'
import { runProgress } from './sections'

const {
  paparazzi,
  block = false,
  locale = 'en'
} = defineProps<{
  paparazzi: PaparazziMe
  block?: boolean
  locale?: Locale
}>()

const { phase, canRun, missingStar } = paparazzi
const now = useNow({ interval: 250 })
</script>

<template>
  <EditorRun
    :label="pc('paparazzi.run', locale)"
    :credits="pc('paparazzi.credits', locale, { n: PAPARAZZI_CREDITS })"
    :cancel-label="pc('paparazzi.cancel', locale)"
    :running="phase.kind === 'running'"
    :progress="runProgress(paparazzi, now.getTime())"
    :queued-label="pc('paparazzi.busy.queued', locale)"
    :disabled="!canRun"
    :missing="missingStar ? pc('paparazzi.needsStar', locale) : undefined"
    :block
    data-testid="paparazzi-run"
    @run="paparazzi.snap"
    @cancel="paparazzi.cancel"
  />
</template>
