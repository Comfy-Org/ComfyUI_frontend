<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { elapsedLabel } from '../../../lib/workshop/elapsed'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import type { SwapImage } from '../../../lib/workshop/hand-product-swap/examples'
import type { Rect } from '../../../lib/workshop/move-anything/arrange'
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

const { setup, product, productName, drawing, phase, resolution } = swap
const touched = ref(false)
watch([() => hand.url, drawing], () => (touched.value = false))

function begin() {
  touched.value = true
  swap.checkpoint()
}

function commit(region: Rect) {
  touched.value = true
  swap.moveBox(region)
}

const now = useNow({ interval: 1000 })
const detail = computed(() =>
  hc('swap.busy.detail', locale, {
    product: productName.value,
    resolution: resolution.value,
    time:
      phase.value.kind === 'running'
        ? elapsedLabel(now.value.getTime() - phase.value.startedAt)
        : ''
  })
)
</script>

<template>
  <div class="relative size-full">
    <HandSwapStage
      :hand
      :product
      :product-name="productName"
      :region="setup.region"
      :drawing
      :locale
      @begin="begin"
      @place="swap.place"
      @commit="commit"
    >
      <HandSwapProductCard
        :product
        :name="productName"
        :locale
        @file="swap.useProductFile"
      />
      <EditorHint
        v-if="!touched && phase.kind === 'editing'"
        :text="hc(drawing ? 'swap.hint.draw' : 'swap.hint', locale)"
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
