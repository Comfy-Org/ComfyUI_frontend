<script setup lang="ts">
import { Play } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { DoorArt } from '@/lib/workshop/explore-art'
import {
  FLOAT,
  MICRO
} from '@/components/workshop/explore-doors/doorPanelClasses'

const { app, locale = 'en' } = defineProps<{
  app: NonNullable<DoorArt['apps']>
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <span :class="cn(FLOAT, 'sm:w-48 sm:translate-x-[-26%]')">
    <span class="block px-3 pt-3">
      <span class="flex items-center justify-between gap-2">
        <span :class="cn(MICRO, 'truncate')">
          {{ t(app.control) }}
        </span>
        <span class="font-mono text-2xs">{{ app.value }}</span>
      </span>
      <span
        class="relative mt-2.5 block h-1 rounded-full bg-primary-warm-white/15"
      >
        <span
          class="absolute inset-y-0 left-0 w-[30%] rounded-full bg-primary-comfy-yellow group-hover:w-[78%] motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
        />
        <span
          class="absolute top-1/2 left-[30%] size-3.5 -translate-1/2 rounded-full bg-primary-warm-white shadow-sm ring-2 ring-primary-comfy-yellow group-hover:left-[78%] motion-safe:transition-[left] motion-safe:duration-700 motion-safe:ease-out"
        />
      </span>
      <span class="mt-2 flex justify-between px-px">
        <span
          v-for="tick in 9"
          :key="tick"
          class="h-1 w-px bg-primary-warm-white/25"
        />
      </span>
    </span>
    <span class="block p-2 pt-3">
      <span
        class="flex items-center justify-center gap-2 rounded-[10px] bg-primary-comfy-yellow py-2 text-xs font-semibold text-primary-comfy-ink group-hover:scale-97 group-hover:ring-4 group-hover:ring-primary-comfy-yellow/30 motion-safe:transition motion-safe:duration-300 motion-safe:group-hover:delay-500"
      >
        <Play class="size-3.5" />
        {{ t('workshop.explore.doorAppGenerate') }}
      </span>
    </span>
  </span>
</template>
