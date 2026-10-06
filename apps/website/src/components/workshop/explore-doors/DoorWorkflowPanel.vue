<script setup lang="ts">
import { Film } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import {
  FLOAT,
  GLASS,
  PORT
} from '@/components/workshop/explore-doors/doorPanelClasses'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const widgets = [
  { label: t('workshop.explore.doorWorkflowLight'), value: '45°' },
  { label: t('workshop.explore.doorWorkflowStrength'), value: '0.80' }
]
</script>

<template>
  <span
    :class="
      cn(
        FLOAT,
        GLASS,
        'sm:w-40 sm:max-w-[calc(100%-1.5rem)] sm:translate-x-[-18%]'
      )
    "
  >
    <span
      class="block border-b border-primary-warm-white/15 px-3 py-2 text-2xs font-semibold"
    >
      {{ t('workshop.explore.doorWorkflowStep') }}
    </span>
    <span class="block px-3 py-1.5">
      <span
        v-for="widget in widgets"
        :key="widget.label"
        class="flex items-center justify-between gap-3 py-1 text-3xs"
      >
        <span class="text-primary-warm-white/65">{{ widget.label }}</span>
        <span>{{ widget.value }}</span>
      </span>
    </span>
    <span :class="cn(PORT, '-left-1.25')" />
    <span :class="cn(PORT, '-right-1.25 motion-safe:group-hover:delay-300')" />
    <span
      class="pointer-events-none absolute top-1/2 left-full h-[calc(50%+1rem)] w-5 rounded-tr-xl border-t-2 border-r-2 border-workflow-selection [clip-path:inset(0_100%_100%_0)] motion-safe:transition-[clip-path] motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:delay-300 motion-safe:group-hover:[clip-path:inset(0)] motion-safe:group-focus-visible:delay-300 motion-safe:group-focus-visible:[clip-path:inset(0)] max-sm:hidden"
      data-testid="explore-door-wire"
    />
    <span
      :class="
        cn(
          GLASS,
          'pointer-events-none absolute top-[calc(100%+1rem)] left-[calc(100%-4rem)] flex w-24 translate-y-1 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-3xs font-semibold whitespace-nowrap opacity-0 motion-safe:transition motion-safe:duration-300 motion-safe:group-hover:translate-y-0 motion-safe:group-hover:opacity-100 motion-safe:group-hover:delay-700 motion-safe:group-focus-visible:translate-y-0 motion-safe:group-focus-visible:opacity-100 motion-safe:group-focus-visible:delay-700 max-sm:hidden'
        )
      "
      data-testid="explore-door-save"
    >
      <span
        class="absolute -top-1.25 right-2 size-2.5 rounded-full bg-primary-warm-white ring-2 ring-primary-warm-white/30"
      />
      <Film class="size-3 shrink-0 text-primary-warm-white/70" />
      {{ t('workshop.explore.doorWorkflowSave') }}
    </span>
  </span>
</template>
