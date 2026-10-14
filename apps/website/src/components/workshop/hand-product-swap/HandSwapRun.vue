<script setup lang="ts">
import type { HandProductSwap } from '@/composables/useHandProductSwap'
import type { Locale } from '@/i18n/translations'
import { SWAP_CREDITS } from '@/lib/workshop/hand-product-swap/contract'
import { hc } from '@/lib/workshop/hand-product-swap/copy'
import EditorRun from '@/components/workshop/app-editor/EditorRun.vue'

const {
  swap,
  block = false,
  locale = 'en'
} = defineProps<{
  swap: HandProductSwap
  block?: boolean
  locale?: Locale
}>()

const { phase, canRun, resolution } = swap
</script>

<template>
  <EditorRun
    :label="hc('swap.run', locale)"
    :credits="hc('swap.credits', locale, { n: SWAP_CREDITS[resolution] })"
    :cancel-label="hc('swap.cancel', locale)"
    :running="phase.kind === 'running'"
    :progress="phase.kind === 'running' ? phase.progress : undefined"
    :queued-label="hc('swap.progress.queued', locale)"
    :disabled="!canRun"
    :block
    data-testid="swap-run"
    @run="swap.swap"
    @cancel="swap.cancel"
  />
</template>
