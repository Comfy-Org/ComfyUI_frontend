<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import type { SwapImage } from '../../../lib/workshop/hand-product-swap/examples'
import { HAND_EXAMPLE } from '../../../lib/workshop/hand-product-swap/examples'
import EditorDropZone from '../app-editor/EditorDropZone.vue'
import EditorFrame from '../app-editor/EditorFrame.vue'

const { hand, locale = 'en' } = defineProps<{
  hand: SwapImage
  locale?: Locale
}>()

const emit = defineEmits<{ file: [file: File] }>()
</script>

<template>
  <EditorFrame :width="hand.width" :height="hand.height">
    <EditorDropZone
      class="relative size-full rounded-sm select-none"
      data-testid="swap-stage"
      @file="emit('file', $event)"
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
    </EditorDropZone>
  </EditorFrame>
</template>
