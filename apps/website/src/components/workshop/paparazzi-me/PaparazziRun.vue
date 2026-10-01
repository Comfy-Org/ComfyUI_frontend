<script setup lang="ts">
import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import { PAPARAZZI_CREDITS } from '../../../lib/workshop/paparazzi-me/mock-run'
import EditorRun from '../app-editor/EditorRun.vue'

const {
  paparazzi,
  block = false,
  locale = 'en'
} = defineProps<{
  paparazzi: PaparazziMe
  block?: boolean
  locale?: Locale
}>()

const { phase, canRun, face } = paparazzi
</script>

<template>
  <EditorRun
    :label="pc('paparazzi.run', locale)"
    :credits="pc('paparazzi.credits', locale, { n: PAPARAZZI_CREDITS })"
    :cancel-label="pc('paparazzi.cancel', locale)"
    :running="phase.kind === 'running'"
    :disabled="!canRun"
    :title="face ? undefined : pc('paparazzi.needsFace', locale)"
    :block
    data-testid="paparazzi-run"
    @run="paparazzi.snap"
    @cancel="paparazzi.cancel"
  />
</template>
