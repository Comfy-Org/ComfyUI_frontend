<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { elapsedLabel } from '../../../lib/workshop/elapsed'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import type { SwapImage } from '../../../lib/workshop/hand-product-swap/examples'
import EditorBusy from '../app-editor/EditorBusy.vue'
import EditorHint from '../app-editor/EditorHint.vue'
import HandSwapProductCard from './HandSwapProductCard.vue'
import HandSwapShimmer from './HandSwapShimmer.vue'
import HandSwapStage from './HandSwapStage.vue'

const {
  hand,
  swap,
  locale = 'en'
} = defineProps<{
  hand: SwapImage
  swap: HandProductSwap
  locale?: Locale
}>()

const { product, productName, phase, resolution } = swap

const now = useNow({ interval: 1000 })
const detail = computed(() => {
  const current = phase.value
  if (current.kind !== 'running') return ''
  return hc('swap.busy.detail', locale, {
    status:
      current.progress.kind === 'queued'
        ? hc('swap.progress.queued', locale)
        : hc('swap.progress.percent', locale, {
            n: current.progress.percent
          }),
    product: productName.value,
    resolution: resolution.value,
    time: elapsedLabel(now.value.getTime() - current.startedAt)
  })
})
</script>

<template>
  <div class="relative size-full">
    <HandSwapStage :hand :locale @file="swap.useHandFile">
      <HandSwapProductCard
        :product
        :name="productName"
        :locale
        @file="swap.useProductFile"
      />
      <EditorHint
        v-if="phase.kind === 'editing'"
        :text="hc('swap.hint', locale)"
        class="max-sm:hidden"
      />
      <template v-if="phase.kind === 'running'">
        <HandSwapShimmer />
        <EditorBusy
          :title="hc('swap.busy.title', locale)"
          :detail
          :cancel-label="hc('swap.cancel', locale)"
          @cancel="swap.cancel"
        />
      </template>
    </HandSwapStage>
  </div>
</template>
