<script setup lang="ts">
import { Replace } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { hc } from '@/lib/workshop/hand-product-swap/copy'
import type { SwapProduct } from '@/lib/workshop/hand-product-swap/examples'
import EditorUploadSlot from '@/components/workshop/app-editor/EditorUploadSlot.vue'

const {
  product,
  name,
  locale = 'en'
} = defineProps<{
  product: SwapProduct
  name: string
  locale?: Locale
}>()

const emit = defineEmits<{ file: [file: File] }>()
</script>

<template>
  <EditorUploadSlot
    :label="hc('swap.product.change', locale)"
    input-test-id="swap-card-input"
    class="group absolute top-2 right-2 flex w-16 rotate-2 flex-col gap-1.5 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink-light/90 p-1.5 text-left shadow-2xl shadow-black/50 backdrop-blur-md transition hover:rotate-0 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none sm:top-3 sm:right-3 sm:w-28"
    data-testid="swap-product-card"
    @file="emit('file', $event)"
  >
    <span
      class="relative block aspect-square overflow-hidden rounded-lg bg-white"
    >
      <img
        :src="product.url"
        alt=""
        draggable="false"
        class="absolute inset-0 m-auto max-h-[88%] max-w-[88%] object-contain mix-blend-multiply"
      />
      <span
        class="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary-comfy-ink/70 text-primary-warm-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      >
        <Replace class="size-3" />
      </span>
    </span>
    <span class="flex flex-col px-0.5 pb-0.5">
      <span class="text-[9px] tracking-wide text-primary-warm-gray uppercase">{{
        hc('swap.product', locale)
      }}</span>
      <span class="truncate text-[11px] text-primary-warm-white">{{
        name
      }}</span>
    </span>
  </EditorUploadSlot>
</template>
