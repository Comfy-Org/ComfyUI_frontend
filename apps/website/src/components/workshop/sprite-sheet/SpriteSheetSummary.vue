<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { SpriteSheet } from '@/composables/useSpriteSheet'
import type { Locale } from '@/i18n/translations'
import { CHECKER } from './checker'
import { setupSummary } from './sections'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { image } = sprite
</script>

<template>
  <span
    :class="
      cn(
        'h-9 w-14 shrink-0 overflow-hidden rounded-md bg-primary-comfy-ink ring-1 ring-transparency-white-t8',
        CHECKER
      )
    "
  >
    <img :src="image?.url" alt="" class="size-full object-contain" />
  </span>
  <span class="min-w-0 flex-1 truncate text-[13px] text-primary-warm-white">{{
    setupSummary(sprite, locale)
  }}</span>
</template>
