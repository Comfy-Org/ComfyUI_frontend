<script setup lang="ts">
import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { product, productName, resolution } = swap
</script>

<template>
  <span
    class="flex size-9 shrink-0 items-center justify-center rounded-md bg-transparency-white-t4 ring-1 ring-transparency-white-t8"
  >
    <img
      :src="product.url"
      alt=""
      class="max-h-[80%] max-w-[80%] object-contain"
    />
  </span>
  <span class="min-w-0 flex-1 truncate text-[13px] text-primary-warm-white">{{
    hc('swap.summary', locale, { product: productName, resolution })
  }}</span>
</template>
