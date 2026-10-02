<script setup lang="ts">
import { ChevronRight, ImageOff } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import { sceneName, sceneThumb } from './sections'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { pickerOpen } = paparazzi
</script>

<template>
  <button
    type="button"
    aria-haspopup="dialog"
    :aria-expanded="pickerOpen"
    :class="
      cn(
        'flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left ring-1 ring-transparency-white-t8 transition-colors ring-inset hover:bg-transparency-white-t4 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40',
        pickerOpen && 'bg-transparency-white-t8'
      )
    "
    data-testid="paparazzi-scene-row"
    @click="paparazzi.openPicker"
  >
    <img
      v-if="sceneThumb(paparazzi)"
      :src="sceneThumb(paparazzi)"
      alt=""
      class="h-8 w-12 shrink-0 rounded-md object-cover"
    />
    <span
      v-else
      class="grid h-8 w-12 shrink-0 place-items-center rounded-md bg-transparency-white-t4 text-primary-warm-gray"
      aria-hidden="true"
    >
      <ImageOff class="size-3.5" />
    </span>
    <span class="w-12 shrink-0 text-xs text-primary-warm-gray">
      {{ pc('paparazzi.scene', locale) }}
    </span>
    <span
      class="min-w-0 flex-1 truncate text-sm font-semibold text-primary-warm-white"
    >
      {{ sceneName(paparazzi, locale) }}
    </span>
    <ChevronRight
      class="size-4 shrink-0 text-primary-warm-gray"
      aria-hidden="true"
    />
  </button>
</template>
