<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { hc } from '@/lib/workshop/hand-product-swap/copy'
import type { SwapImage } from '@/lib/workshop/hand-product-swap/examples'
import { HAND_EXAMPLE } from '@/lib/workshop/hand-product-swap/examples'
import EditorFrame from '@/components/workshop/app-editor/EditorFrame.vue'

const { hand, locale = 'en' } = defineProps<{
  hand: SwapImage
  locale?: Locale
}>()
</script>

<template>
  <EditorFrame :width="hand.width" :height="hand.height">
    <div
      class="relative size-full rounded-sm select-none"
      data-testid="swap-stage"
    >
      <img
        :src="hand.url"
        :alt="
          hand.url === HAND_EXAMPLE.url
            ? hc('swap.alt.example', locale)
            : hand.name
        "
        draggable="false"
        class="pointer-events-none size-full rounded-sm object-cover"
      />
      <slot />
    </div>
  </EditorFrame>
</template>
