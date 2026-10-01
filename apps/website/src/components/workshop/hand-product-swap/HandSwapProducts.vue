<script setup lang="ts">
import { Upload } from '@lucide/vue'

import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import HandSwapProductTile from './HandSwapProductTile.vue'
import HandSwapUpload from './HandSwapUpload.vue'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { products, setup } = swap
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="hc('swap.product', locale)"
    class="grid grid-cols-4 gap-x-2 gap-y-3 px-1"
  >
    <HandSwapProductTile
      v-for="product in products"
      :key="product.id"
      :product
      :name="
        product.label
          ? hc(product.label, locale)
          : hc('swap.product.own', locale)
      "
      :selected="product.id === setup.productId"
      @pick="swap.pickProduct(product.id)"
    />
    <HandSwapUpload
      :label="hc('swap.product.uploadLabel', locale)"
      input-id="swap-product-input"
      class="group flex min-w-0 flex-col gap-1 text-left focus-visible:outline-none"
      @file="swap.useProductFile"
    >
      <span
        class="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-transparency-white-t20 text-primary-warm-gray transition group-hover:border-transparency-white-t20 group-hover:bg-transparency-white-t4 group-hover:text-primary-warm-white group-focus-visible:ring-2 group-focus-visible:ring-primary-comfy-yellow/60"
      >
        <Upload class="size-4" aria-hidden="true" />
      </span>
      <span
        class="truncate text-xs text-primary-warm-gray group-hover:text-primary-comfy-canvas"
        >{{ hc('swap.product.upload', locale) }}</span
      >
    </HandSwapUpload>
  </div>
  <p class="px-1 text-[11px] text-primary-warm-gray">
    {{ hc('swap.product.tip', locale) }}
  </p>
</template>
