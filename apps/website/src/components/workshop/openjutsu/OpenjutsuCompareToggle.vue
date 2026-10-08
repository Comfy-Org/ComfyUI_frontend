<script setup lang="ts">
import { Film, Sparkles } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StageCompare } from '@/lib/workshop/openjutsu/take'

/** Flips the player between a take's result and the clip it was made from. */
const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const compare = defineModel<StageCompare>({ required: true })

const OPTIONS = [
  { id: 'result', icon: Sparkles, label: 'reshoot.view.result' },
  { id: 'source', icon: Film, label: 'reshoot.view.source' }
] as const
</script>

<template>
  <div
    class="flex rounded-full bg-transparency-white-t4 p-1 ring-1 ring-transparency-white-t8 ring-inset"
    role="radiogroup"
    :aria-label="t('reshoot.views')"
  >
    <button
      v-for="option in OPTIONS"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="compare === option.id"
      :class="
        cn(
          'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors',
          compare === option.id
            ? 'bg-primary-warm-white text-primary-comfy-ink'
            : 'text-primary-comfy-canvas hover:bg-transparency-white-t8 hover:text-primary-warm-white'
        )
      "
      @click="compare = option.id"
    >
      <component :is="option.icon" class="size-3.5" aria-hidden="true" />
      {{ t(option.label) }}
    </button>
  </div>
</template>
