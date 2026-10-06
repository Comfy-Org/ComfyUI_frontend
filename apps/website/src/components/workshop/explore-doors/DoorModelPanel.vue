<script setup lang="ts">
import { Sparkles } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { DoorArt } from '@/lib/workshop/explore-art'
import { initialsOf } from '@/lib/workshop/initials'
import { FLOAT } from '@/components/workshop/explore-doors/doorPanelClasses'

const { model, locale = 'en' } = defineProps<{
  model: NonNullable<DoorArt['models']>
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const price = computed(() => {
  if (model.usd !== undefined) return `$${model.usd.toFixed(2)}`
  if (model.credits !== undefined)
    return t('workshop.explore.doorModelCredits', { credits: model.credits })
  return undefined
})

const meta = computed(() =>
  model.provider
    ? t('workshop.explore.doorModelMeta', { provider: model.provider })
    : t('workshop.explore.doorModelImage')
)
</script>

<template>
  <span :class="cn(FLOAT, 'sm:w-52 sm:translate-x-[-30%]')">
    <span
      class="flex items-center gap-1.5 px-3 pt-2.5 text-2xs text-primary-warm-white/70"
    >
      <Sparkles class="size-3 shrink-0 text-primary-comfy-yellow" />
      <span class="truncate">{{ t(model.prompt) }}</span>
      <span
        class="-ml-0.5 inline-block h-3 w-px shrink-0 bg-primary-comfy-yellow motion-safe:animate-cursor-blink"
      />
    </span>
    <span
      class="mt-2.5 flex items-center gap-2.5 border-t border-primary-warm-white/10 px-3 pt-2.5"
    >
      <span
        v-if="model.provider"
        class="grid size-7 shrink-0 place-items-center rounded-lg bg-illustration-forest text-3xs font-bold ring-1 ring-primary-warm-white/15"
      >
        {{ initialsOf(model.provider) }}
      </span>
      <span class="min-w-0">
        <span class="block truncate text-xs font-semibold">
          {{ model.name }}
        </span>
        <span class="block truncate text-3xs text-primary-warm-white/50">
          {{ meta }}
        </span>
      </span>
    </span>
    <span class="flex items-center justify-between gap-2 px-3 py-2.5">
      <span
        class="flex gap-1 rounded-lg bg-primary-warm-white/5 p-0.5 text-3xs font-medium"
      >
        <span
          class="rounded-md bg-primary-warm-white/15 px-2 py-0.5 group-hover:bg-transparent group-hover:text-primary-warm-white/60 motion-safe:transition-colors motion-safe:duration-300"
        >
          {{ t('workshop.explore.doorModelRun') }}
        </span>
        <span
          class="rounded-md px-2 py-0.5 text-primary-warm-white/60 group-hover:bg-primary-warm-white/15 group-hover:text-primary-warm-white motion-safe:transition-colors motion-safe:duration-300"
        >
          {{ t('workshop.explore.doorModelApi') }}
        </span>
      </span>
      <span
        v-if="price"
        class="font-mono text-2xs whitespace-nowrap text-primary-comfy-yellow"
      >
        {{ price }}
        <span class="text-primary-warm-white/40">
          {{ t('workshop.explore.doorModelPerImage') }}
        </span>
      </span>
    </span>
  </span>
</template>
