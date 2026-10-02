<script setup lang="ts">
import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import { TRY_ON_CREDITS } from '../../../lib/workshop/virtual-try-on/mock-run'
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
</script>

<template>
  <EditorRun
    :label="vc(missing ? 'tryOn.run.missing' : 'tryOn.run', locale)"
    :credits="vc('tryOn.credits', locale, { n: TRY_ON_CREDITS })"
    :cancel-label="vc('tryOn.cancel', locale)"
    :running="phase.kind === 'running'"
    :disabled="!canRun"
    :block
    data-testid="try-on-run"
    @run="tryOn.tryOn"
    @cancel="tryOn.cancel"
  />
</template>
