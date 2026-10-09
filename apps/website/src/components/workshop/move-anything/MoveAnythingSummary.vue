<script setup lang="ts">
import type { useMoveAnything } from '@/composables/useMoveAnything'
import type { Locale } from '@/i18n/translations'
import { mc } from '@/lib/workshop/move-anything/copy'

const { move, locale = 'en' } = defineProps<{
  move: ReturnType<typeof useMoveAnything>
  locale?: Locale
}>()

const { image, objects, moved, quality } = move
</script>

<template>
  <img
    :src="image?.url"
    alt=""
    class="h-9 w-14 shrink-0 rounded-md object-cover ring-1 ring-transparency-white-t8"
  />
  <span class="min-w-0 flex-1 truncate text-[13px] text-primary-warm-white">{{
    mc('move.summary', locale, {
      n: objects.length,
      moved: moved.length,
      quality: mc(
        quality === 'fast' ? 'move.quality.fast' : 'move.quality.best',
        locale
      )
    })
  }}</span>
</template>
