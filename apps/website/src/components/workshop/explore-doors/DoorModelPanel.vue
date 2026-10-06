<script setup lang="ts">
import { Play } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { DoorArt } from '@/lib/workshop/explore-art'
import {
  ACTION_PILL,
  FLOAT,
  GLASS
} from '@/components/workshop/explore-doors/doorPanelClasses'

const { model, locale = 'en' } = defineProps<{
  model: Pick<NonNullable<DoorArt['models']>, 'name' | 'prompt'>
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <span :class="cn(FLOAT, GLASS, 'p-3 sm:w-48 sm:translate-x-[-30%]')">
    <span class="block text-2xs leading-snug text-primary-warm-white/90">
      {{ t(model.prompt) }}
      <span
        class="ml-0.5 inline-block h-3 w-px translate-y-0.5 bg-primary-comfy-yellow opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:group-hover:animate-cursor-blink motion-safe:group-focus-visible:animate-cursor-blink"
        data-testid="explore-door-caret"
      />
    </span>
    <span
      class="mt-3 flex items-center justify-between gap-2 border-t border-primary-warm-white/15 pt-2.5"
    >
      <span class="truncate text-3xs text-primary-warm-white/70">
        {{ model.name }}
      </span>
      <span
        :class="cn(ACTION_PILL, 'shrink-0 px-2.5 py-1 group-hover:delay-300')"
      >
        <Play class="size-2.5" />
        {{ t('workshop.explore.doorModelRun') }}
      </span>
    </span>
  </span>
</template>
