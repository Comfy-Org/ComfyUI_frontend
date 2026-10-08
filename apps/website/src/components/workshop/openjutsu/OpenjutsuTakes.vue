<script setup lang="ts">
import { CircleStop, Film, LoaderCircle } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SwapTake } from '@/lib/workshop/openjutsu/take'

/** The strip under the stage: the source clip, then every take made from it. */
const {
  takes,
  selected,
  rendering,
  locale = 'en'
} = defineProps<{
  takes: readonly SwapTake[]
  /** `source`, or a take's id. */
  selected: string
  rendering: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ select: [id: string] }>()

const tileClass = (id: string) =>
  cn(
    'grid aspect-video h-14 shrink-0 place-items-center overflow-hidden rounded-md bg-transparency-white-t8 transition-opacity',
    id === selected
      ? 'opacity-100 outline-2 outline-offset-2 outline-primary-warm-white'
      : 'opacity-60 hover:opacity-100'
  )
</script>

<template>
  <nav
    :aria-label="t('reshoot.takes')"
    class="flex max-w-full items-center gap-2 overflow-x-auto p-1"
  >
    <button
      type="button"
      :aria-current="selected === 'source'"
      :aria-label="t('openjutsu.take.source')"
      :class="cn(tileClass('source'), 'text-primary-warm-white')"
      @click="emit('select', 'source')"
    >
      <Film class="size-4" aria-hidden="true" />
    </button>
    <span class="mx-1 h-8 w-px bg-transparency-white-t8" aria-hidden="true" />
    <button
      v-for="take in takes"
      :key="take.id"
      type="button"
      :aria-current="selected === take.id"
      :aria-label="t('openjutsu.take.name', { n: take.n })"
      :class="tileClass(take.id)"
      @click="emit('select', take.id)"
    >
      <video
        v-if="take.url"
        :src="take.url"
        muted
        playsinline
        preload="metadata"
        class="size-full object-cover"
      />
      <LoaderCircle
        v-else-if="take.status === 'rendering'"
        class="size-4 text-primary-comfy-yellow motion-safe:animate-spin"
        aria-hidden="true"
      />
      <CircleStop
        v-else
        class="size-4 text-primary-comfy-canvas"
        aria-hidden="true"
      />
    </button>
    <span v-if="rendering" class="sr-only" role="status">
      {{ t('openjutsu.phase.running') }}
    </span>
  </nav>
</template>
