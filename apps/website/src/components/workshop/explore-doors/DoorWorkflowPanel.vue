<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import {
  FLOAT,
  PORT,
  WIDGET
} from '@/components/workshop/explore-doors/doorPanelClasses'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const widgets = [
  {
    label: t('workshop.explore.doorWorkflowImage'),
    value: t('workshop.explore.doorWorkflowFile')
  },
  { label: t('workshop.explore.doorWorkflowLight'), value: '45°' },
  { label: t('workshop.explore.doorWorkflowStrength'), value: '0.80' }
]
</script>

<template>
  <span
    :class="
      cn(FLOAT, 'sm:w-40 sm:max-w-[calc(100%-1rem)] sm:translate-x-[-18%]')
    "
  >
    <span
      class="flex items-center gap-1.5 border-b border-primary-warm-white/10 px-2.5 py-1.5 text-2xs font-semibold"
    >
      <span class="size-1.5 rounded-full bg-primary-comfy-yellow" />
      {{ t('workshop.explore.doorWorkflowStep') }}
    </span>
    <span class="relative flex flex-col gap-1 p-2">
      <span v-for="widget in widgets" :key="widget.label" :class="WIDGET">
        <span class="text-primary-warm-white/55">
          {{ widget.label }}
        </span>
        <span class="truncate font-mono">{{ widget.value }}</span>
      </span>
      <span
        class="pointer-events-none absolute top-1/2 left-full h-[calc(50%+1rem)] w-5 rounded-tr-xl border-t-2 border-r-2 border-primary-comfy-yellow [clip-path:inset(0_100%_100%_0)] motion-safe:transition-[clip-path] motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:delay-300 motion-safe:group-hover:[clip-path:inset(0)] max-sm:hidden"
        data-testid="explore-door-wire"
      />
      <span
        class="pointer-events-none absolute top-[calc(100%+1rem)] -right-7 flex translate-y-1 items-center gap-1.5 rounded-lg bg-primary-comfy-ink px-2 py-1 text-3xs font-semibold whitespace-nowrap opacity-0 shadow-xl ring-1 ring-primary-warm-white/10 motion-safe:transition motion-safe:duration-300 motion-safe:group-hover:translate-y-0 motion-safe:group-hover:opacity-100 motion-safe:group-hover:delay-700 max-sm:hidden"
      >
        <span class="size-1.5 rounded-full bg-primary-comfy-yellow" />
        {{ t('workshop.explore.doorWorkflowSave') }}
      </span>
      <span
        :class="
          cn(
            PORT,
            '-left-1.5 group-hover:scale-150 motion-safe:transition-transform motion-safe:duration-300'
          )
        "
      />
      <span
        :class="
          cn(
            PORT,
            '-right-1.5 group-hover:scale-150 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:delay-300'
          )
        "
      />
    </span>
  </span>
</template>
