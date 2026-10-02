<script setup lang="ts">
import { computed } from 'vue'

import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import { HAND_EXAMPLE } from '../../../lib/workshop/hand-product-swap/examples'
import EditorEmpty from '../app-editor/EditorEmpty.vue'
import EditorResult from '../app-editor/EditorResult.vue'
import HandSwapWorkspace from './HandSwapWorkspace.vue'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { hand, phase, comparing } = swap
const labels = computed(() => ({
  resultAlt: hc('swap.alt.result', locale),
  originalAlt:
    hand.value?.url === HAND_EXAMPLE.url
      ? hc('swap.alt.example', locale)
      : (hand.value?.name ?? ''),
  original: hc('swap.view.original', locale),
  result: hc('swap.view.result', locale),
  slider: hc('swap.compare.slider', locale)
}))
</script>

<template>
  <EditorEmpty
    v-if="!hand"
    :title="hc('swap.empty.title', locale)"
    :meta="hc('swap.empty.meta', locale)"
    :upload-label="hc('swap.empty.upload', locale)"
    :example-label="hc('swap.empty.example', locale)"
    :example-image="HAND_EXAMPLE.url"
    data-testid="swap-empty"
    @file="swap.useHandFile"
    @example="swap.useExample"
  />
  <EditorResult
    v-else-if="phase.kind === 'done'"
    :before="hand.url"
    :after="phase.result.url"
    :view="comparing ? 'compare' : 'result'"
    :width="hand.width"
    :height="hand.height"
    :labels
  />
  <HandSwapWorkspace v-else :hand :swap :locale />
</template>
