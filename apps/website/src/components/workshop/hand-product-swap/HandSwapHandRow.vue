<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import type { SwapImage } from '../../../lib/workshop/hand-product-swap/examples'
import EditorUploadSlot from '../app-editor/EditorUploadSlot.vue'

const { hand, locale = 'en' } = defineProps<{
  hand: SwapImage
  locale?: Locale
}>()

const emit = defineEmits<{ file: [file: File] }>()
</script>

<template>
  <div class="flex items-center gap-3 px-1 pt-2 pb-3">
    <img :src="hand.url" alt="" class="size-10 rounded-lg object-cover" />
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="text-[11px] text-primary-warm-gray">{{
        hc('swap.hand', locale)
      }}</span>
      <span class="truncate text-xs text-primary-warm-white">{{
        hand.name
      }}</span>
    </span>
    <EditorUploadSlot
      :label="hc('swap.hand.change', locale)"
      input-test-id="swap-hand-input"
      class="h-7 shrink-0 rounded-full bg-transparency-white-t8 px-3 text-xs text-primary-warm-white transition hover:bg-transparency-white-t20 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
      @file="emit('file', $event)"
    >
      {{ hc('swap.change', locale) }}
    </EditorUploadSlot>
  </div>
</template>
