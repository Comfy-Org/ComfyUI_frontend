<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import {
  TRY_ON_CREDITS,
  mockProgress
} from '../../../lib/workshop/virtual-try-on/mock-run'
import EditorRun from '../app-editor/EditorRun.vue'

const {
  tryOn,
  block = false,
  locale = 'en'
} = defineProps<{
  tryOn: VirtualTryOn
  block?: boolean
  locale?: Locale
}>()

const { phase, canRun, missing } = tryOn
const now = useNow({ interval: 200 })
const progress = computed(() =>
  phase.value.kind === 'running'
    ? mockProgress(now.value.getTime() - phase.value.startedAt)
    : undefined
)
</script>

<template>
  <EditorRun
    :label="vc('tryOn.run', locale)"
    :credits="vc('tryOn.credits', locale, { n: TRY_ON_CREDITS })"
    :cancel-label="vc('tryOn.cancel', locale)"
    :running="phase.kind === 'running'"
    :progress
    :queued-label="vc('tryOn.busy.queued', locale)"
    :disabled="!canRun"
    :missing="missing ? vc('tryOn.run.missing', locale) : undefined"
    :block
    data-testid="try-on-run"
    @run="tryOn.tryOn"
    @cancel="tryOn.cancel"
  />
</template>
