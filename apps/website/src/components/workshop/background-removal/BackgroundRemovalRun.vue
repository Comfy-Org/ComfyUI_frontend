<script setup lang="ts">
import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { brc } from '../../../lib/workshop/background-removal/copy'
import { CUTOUT_CREDITS } from '../../../lib/workshop/background-removal/mock-run'
import EditorRun from '../app-editor/EditorRun.vue'

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
</script>

<template>
  <EditorRun
    :label="brc(`cutout.run.${setup.mode}`, locale)"
    :credits="brc('cutout.credits', locale, { n: CUTOUT_CREDITS[setup.mode] })"
    :cancel-label="brc('cutout.cancel', locale)"
    :running="phase.kind === 'running'"
    :disabled="!canRun"
    :block
    :title="missing ? brc('cutout.replace.missing', locale) : undefined"
    data-testid="background-removal-run"
    @run="cutout.removeBackground"
    @cancel="cutout.cancel"
  />
</template>
