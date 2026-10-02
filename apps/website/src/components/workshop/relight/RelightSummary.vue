<script setup lang="ts">
import { useMoodThumbnails } from '../../../composables/useMoodThumbnails'
import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { setupSummary } from './sections'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { image, setup } = relight
const thumbnails = useMoodThumbnails(
  () => image.value?.url,
  () => setup.value.scene
)
</script>

<template>
  <img
    :src="thumbnails[setup.mood] ?? image?.url"
    alt=""
    class="h-9 w-14 shrink-0 rounded-md object-cover ring-1 ring-transparency-white-t8"
  />
  <span class="min-w-0 flex-1 truncate text-[13px] text-primary-warm-white">{{
    setupSummary(relight, locale)
  }}</span>
</template>
