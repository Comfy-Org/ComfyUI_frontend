<script setup lang="ts">
import type { BackgroundRemoval } from '@/composables/useBackgroundRemoval'
import type { Locale } from '@/i18n/translations'
import BackgroundRemovalThumb from './BackgroundRemovalThumb.vue'
import { setupSummary } from './sections'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { image, setup } = cutout
</script>

<template>
  <span
    class="relative h-9 w-14 shrink-0 overflow-hidden rounded-md ring-1 ring-transparency-white-t8"
  >
    <BackgroundRemovalThumb :setup :image />
  </span>
  <span class="min-w-0 flex-1 truncate text-[13px] text-primary-warm-white">{{
    setupSummary(cutout, locale)
  }}</span>
</template>
