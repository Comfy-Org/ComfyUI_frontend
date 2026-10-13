<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { PendingSlot } from '@/lib/darkroom/feed'
import { pendingLabel } from '@/lib/darkroom/feed'
import { startLoadingTile, stopLoadingTile } from '@/lib/darkroom/shader'
import { shapeRatio } from '@/lib/darkroom/vocabulary'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  tile,
  shape,
  locale = 'en'
} = defineProps<{
  tile: PendingSlot
  shape: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ cancel: [] }>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const now = ref(Date.now())
useIntervalFn(() => {
  now.value = Date.now()
}, 1000)

watch(
  canvas,
  (element, _previous, onCleanup) => {
    if (!element) return
    startLoadingTile(element, shapeRatio(shape), tile.seed)
    onCleanup(() => stopLoadingTile(element))
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  if (canvas.value) stopLoadingTile(canvas.value)
})

const label = computed(() => {
  const { key, values } = pendingLabel(tile, now.value)
  return t(`darkroom.tile.${key}`, values ?? {})
})
</script>

<template>
  <canvas
    ref="canvas"
    :class="
      cn(
        'absolute inset-0 block size-full transition-opacity duration-500',
        tile.phase !== 'running' && 'opacity-40'
      )
    "
  />
  <span
    class="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink/55 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-warm-white uppercase"
  >
    <span
      class="size-1.5 shrink-0 rounded-full bg-primary-comfy-orange motion-safe:animate-pulse"
    />
    {{ label }}
  </span>
  <button
    type="button"
    class="absolute right-2.5 bottom-2.5 cursor-pointer rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink/85 px-2.5 py-1.5 text-xs font-bold tracking-wider text-primary-warm-white uppercase opacity-0 transition-opacity group-hover/tile:opacity-100 hover:bg-primary-warm-white hover:text-primary-comfy-ink focus-visible:opacity-100 pointer-coarse:opacity-100"
    :title="t('darkroom.tile.cancelTitle')"
    @click.stop="emit('cancel')"
  >
    {{ t('darkroom.tile.cancel') }}
  </button>
</template>
