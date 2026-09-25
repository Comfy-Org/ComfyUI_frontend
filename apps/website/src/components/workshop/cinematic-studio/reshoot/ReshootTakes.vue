<script setup lang="ts">
import { CircleStop, Crosshair, LoaderCircle } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ReshootTake } from '../../../../composables/useReshootRun'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import { takeLabel } from './take-label'

const {
  takes,
  selected,
  locale = 'en'
} = defineProps<{
  takes: readonly ReshootTake[]
  selected: string
  locale?: Locale
}>()

const emit = defineEmits<{ select: [id: string] }>()

const tileClass = (id: string) =>
  cn(
    'grid aspect-video h-14 shrink-0 place-items-center overflow-hidden rounded-md bg-transparency-white-t8 transition-opacity',
    id === selected
      ? 'opacity-100 outline-2 outline-offset-2 outline-primary-warm-white'
      : 'opacity-50 hover:opacity-100'
  )
</script>

<template>
  <nav
    :aria-label="rc('reshoot.takes', locale)"
    class="flex max-w-full items-center gap-2 overflow-x-auto p-1"
  >
    <button
      type="button"
      :aria-current="selected === 'aim'"
      :aria-label="rc('reshoot.take.aim', locale)"
      :class="cn(tileClass('aim'), 'text-primary-warm-white')"
      @click="emit('select', 'aim')"
    >
      <Crosshair class="size-4" aria-hidden="true" />
    </button>
    <span class="mx-1 h-8 w-px bg-transparency-white-t8" aria-hidden="true" />
    <button
      v-for="take in takes"
      :key="take.id"
      type="button"
      :aria-current="selected === take.id"
      :aria-label="takeLabel(take, locale)"
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
  </nav>
</template>
