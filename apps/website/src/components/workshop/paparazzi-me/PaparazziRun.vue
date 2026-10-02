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

const { phase, canRun, missingStar } = paparazzi
</script>

<template>
  <p
    v-if="block && missingStar"
    class="pb-2 text-center text-[11px] text-primary-warm-gray"
    data-testid="paparazzi-missing"
  >
    {{ pc('paparazzi.needsStar', locale) }}
  </p>
  <EditorRun
    :label="pc('paparazzi.run', locale)"
    :credits="pc('paparazzi.credits', locale, { n: PAPARAZZI_CREDITS })"
    :cancel-label="pc('paparazzi.cancel', locale)"
    :running="phase.kind === 'running'"
    :disabled="!canRun"
    :title="missingStar ? pc('paparazzi.needsStar', locale) : undefined"
    :block
    data-testid="paparazzi-run"
    @run="paparazzi.snap"
    @cancel="paparazzi.cancel"
  />
</template>
