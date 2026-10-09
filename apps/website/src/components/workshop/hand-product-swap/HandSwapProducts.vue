<script setup lang="ts">
import { computed } from 'vue'

import type { HandProductSwap } from '@/composables/useHandProductSwap'
import type { Locale } from '@/i18n/translations'
import { hc } from '@/lib/workshop/hand-product-swap/copy'
import EditorTiles from '@/components/workshop/app-editor/EditorTiles.vue'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { products, setup } = swap
const options = computed(() =>
  products.value.map((product) => ({
    id: product.id,
    label: product.label
      ? hc(product.label, locale)
      : hc('swap.product.own', locale),
    src: product.url
  }))
)
const picked = computed({
  get: () => setup.value.productId,
  set: (id?: string) => id && swap.pickProduct(id)
})
</script>

<template>
  <EditorTiles
    v-model="picked"
    :label="hc('swap.product', locale)"
    :options
    :columns="4"
    aspect="square"
    :upload="{
      label: hc('swap.product.uploadLabel', locale),
      caption: hc('swap.product.upload', locale),
      inputTestId: 'swap-product-input'
    }"
    @upload="swap.useProductFile"
  >
    <template #tile="{ option }">
      <span class="absolute inset-0 bg-white">
        <img
          :src="option.src"
          alt=""
          draggable="false"
          class="absolute inset-0 m-auto max-h-[86%] max-w-[86%] object-contain mix-blend-multiply"
        />
      </span>
    </template>
  </EditorTiles>
  <p class="px-1 text-[11px] text-primary-warm-gray">
    {{ hc('swap.product.tip', locale) }}
  </p>
</template>
