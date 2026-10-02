<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { brc } from '../../../lib/workshop/background-removal/copy'
import {
  CUTOUT_CREDITS,
  CUTOUT_RUN_MS
} from '../../../lib/workshop/background-removal/mock-run'
import EditorRun from '../app-editor/EditorRun.vue'
import { clockProgress } from '../app-editor/run-progress'

const {
  cutout,
  block = false,
  locale = 'en'
} = defineProps<{
  cutout: BackgroundRemoval
  block?: boolean
  locale?: Locale
}>()

const { phase, canRun, setup, missing } = cutout
const now = useNow({ interval: 250 })
const progress = computed(() =>
  phase.value.kind === 'running'
    ? clockProgress(now.value.getTime() - phase.value.startedAt, CUTOUT_RUN_MS)
    : undefined
)
</script>

<template>
  <EditorRun
    :label="brc(`cutout.run.${setup.mode}`, locale)"
    :credits="brc('cutout.credits', locale, { n: CUTOUT_CREDITS[setup.mode] })"
    :cancel-label="brc('cutout.cancel', locale)"
    :running="phase.kind === 'running'"
    :progress
    :disabled="!canRun"
    :missing="missing ? brc('cutout.replace.missing', locale) : undefined"
    :missing-hint="brc('cutout.replace.missing.full', locale)"
    :block
    data-testid="background-removal-run"
    @run="cutout.removeBackground"
    @cancel="cutout.cancel"
  />
</template>
