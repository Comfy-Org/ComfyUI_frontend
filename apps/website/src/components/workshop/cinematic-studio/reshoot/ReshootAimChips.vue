<script setup lang="ts">
import { ArrowLeft, KeyRound } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ReshootCamera } from '../../../../lib/workshop/cinematic-studio/reshoot'
import { cameraZone } from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import type { ReshootPopover } from './popover'
import ReshootZone from './ReshootZone.vue'

const {
  clip,
  camera,
  keyCount,
  openPopover,
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  keyCount: number
  openPopover?: ReshootPopover
  locale?: Locale
}>()

const emit = defineEmits<{ open: [key: ReshootPopover]; back: [] }>()

const moveLabel = computed(() =>
  keyCount > 1
    ? rc('reshoot.move.keys', locale).replace('{count}', String(keyCount))
    : rc('reshoot.move.static', locale)
)

const chipClass = (key: ReshootPopover) =>
  cn(
    'flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] whitespace-nowrap text-primary-comfy-canvas ring-1 ring-transparency-white-t8 transition-colors ring-inset hover:bg-transparency-white-t4 hover:text-primary-warm-white',
    openPopover === key &&
      'bg-transparency-white-t8 text-primary-warm-white ring-transparency-white-t20'
  )
</script>

<template>
  <div class="flex items-center gap-1.5">
    <button
      type="button"
      class="flex h-9 shrink-0 items-center gap-2 rounded-xl pr-3 pl-1 text-[13px] text-primary-warm-gray hover:bg-transparency-white-t4 hover:text-primary-warm-white"
      @click="emit('back')"
    >
      <video
        :src="clip"
        muted
        playsinline
        preload="metadata"
        class="size-7 rounded-lg object-cover"
      />
      <ArrowLeft class="size-3.5" aria-hidden="true" />
      {{ rc('reshoot.back', locale) }}
    </button>
    <span class="mx-1 h-5 w-px bg-transparency-white-t8" aria-hidden="true" />
    <button
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="openPopover === 'camera'"
      :class="chipClass('camera')"
      @click="emit('open', 'camera')"
    >
      <ReshootZone :zone="cameraZone(camera)" dot-only />
      {{ rc('reshoot.section.camera', locale) }}
      <span class="font-mono text-primary-warm-gray tabular-nums">
        {{ camera.azimuth }}° · {{ camera.elevation }}°
      </span>
    </button>
    <button
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="openPopover === 'move'"
      :class="chipClass('move')"
      @click="emit('open', 'move')"
    >
      <KeyRound class="size-3.5" aria-hidden="true" />
      {{ moveLabel }}
    </button>
  </div>
</template>
