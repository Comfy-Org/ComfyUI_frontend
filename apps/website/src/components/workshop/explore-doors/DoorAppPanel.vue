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

const { app, locale = 'en' } = defineProps<{
  app: NonNullable<DoorArt['apps']>
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <span
    :class="cn(FLOAT, GLASS, 'p-3 sm:w-48 sm:translate-x-[-26%]')"
    data-testid="explore-door-panel"
  >
    <span class="flex items-center justify-between gap-2 text-3xs">
      <span class="truncate text-primary-warm-white/65">
        {{ t(app.control) }}
      </span>
      <span>{{ app.value }}</span>
    </span>
    <span
      class="relative mt-2.5 block h-1 rounded-full bg-primary-warm-white/20"
    >
      <span
        class="absolute inset-y-0 left-0 w-[30%] rounded-full bg-primary-comfy-yellow motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:w-[78%] motion-safe:group-focus-visible:w-[78%]"
      />
      <span
        class="absolute top-1/2 left-[30%] size-3 -translate-1/2 rounded-full bg-primary-warm-white shadow-sm motion-safe:transition-[left] motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:left-[78%] motion-safe:group-focus-visible:left-[78%]"
      />
    </span>
    <span
      :class="
        cn(
          ACTION_PILL,
          'mt-3 flex w-full py-1.5 group-hover:delay-500 motion-safe:group-hover:scale-97 motion-safe:group-focus-visible:scale-97'
        )
      "
    >
      <Play class="size-3" />
      {{ t('workshop.explore.doorAppGenerate') }}
    </span>
  </span>
</template>
