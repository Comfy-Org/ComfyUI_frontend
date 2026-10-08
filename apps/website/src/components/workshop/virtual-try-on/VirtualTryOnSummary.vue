<script setup lang="ts">
import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { setupSummary } from './sections'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { person, garment } = tryOn
</script>

<template>
  <span class="flex shrink-0 -space-x-2">
    <img
      :src="person.url"
      alt=""
      class="size-9 rounded-md object-cover ring-1 ring-transparency-white-t8"
    />
    <img
      v-if="garment"
      :src="garment.url"
      alt=""
      class="size-9 rounded-md bg-primary-warm-white object-cover ring-2 ring-primary-comfy-ink-light"
    />
  </span>
  <span class="min-w-0 flex-1 truncate text-[13px] text-primary-warm-white">{{
    setupSummary(tryOn, locale)
  }}</span>
</template>
