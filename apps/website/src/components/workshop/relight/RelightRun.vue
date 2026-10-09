<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import {
  RELIGHT_CREDITS,
  RELIGHT_RUN_MS
} from '@/lib/workshop/relight/mock-run'
import EditorRun from '@/components/workshop/app-editor/EditorRun.vue'
import { clockProgress } from '@/components/workshop/app-editor/run-progress'

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
const now = useNow({ interval: 250 })
const progress = computed(() =>
  phase.value.kind === 'running'
    ? clockProgress(now.value.getTime() - phase.value.startedAt, RELIGHT_RUN_MS)
    : undefined
)
</script>

<template>
  <EditorRun
    :label="lc('relight.run', locale)"
    :credits="lc('relight.credits', locale, { n: RELIGHT_CREDITS })"
    :cancel-label="lc('relight.cancel', locale)"
    :running="phase.kind === 'running'"
    :progress
    :disabled="!canRun"
    :block
    data-testid="relight-run"
    @run="relight.relight"
    @cancel="relight.cancel"
  />
</template>
