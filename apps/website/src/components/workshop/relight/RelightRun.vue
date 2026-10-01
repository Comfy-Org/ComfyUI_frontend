<script setup lang="ts">
import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import { RELIGHT_CREDITS } from '../../../lib/workshop/relight/mock-run'
import EditorRun from '../app-editor/EditorRun.vue'

const {
  relight,
  block = false,
  locale = 'en'
} = defineProps<{
  relight: Relight
  block?: boolean
  locale?: Locale
}>()

const { phase, canRun } = relight
</script>

<template>
  <EditorRun
    :label="lc('relight.run', locale)"
    :credits="lc('relight.credits', locale, { n: RELIGHT_CREDITS })"
    :cancel-label="lc('relight.cancel', locale)"
    :running="phase.kind === 'running'"
    :disabled="!canRun"
    :block
    data-testid="relight-run"
    @run="relight.relight"
    @cancel="relight.cancel"
  />
</template>
