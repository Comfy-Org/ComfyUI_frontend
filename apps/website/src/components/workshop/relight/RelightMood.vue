<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { MoodId } from '../../../lib/workshop/relight/lights'
import { MOOD_IDS, MOOD_LABELS } from '../../../lib/workshop/relight/lights'

const { mood, locale = 'en' } = defineProps<{
  mood: MoodId
  locale?: Locale
}>()

const emit = defineEmits<{ pick: [mood: MoodId] }>()
</script>

<template>
  <div class="flex flex-col gap-2 px-1">
    <span class="text-xs text-primary-warm-gray">{{
      lc('relight.mood', locale)
    }}</span>
    <div
      role="radiogroup"
      :aria-label="lc('relight.mood', locale)"
      class="flex flex-wrap gap-1.5"
    >
      <button
        v-for="id in MOOD_IDS"
        :key="id"
        type="button"
        role="radio"
        :aria-checked="mood === id"
        :class="
          cn(
            'h-7 rounded-full border border-transparency-white-t20 px-3 text-[11px] text-primary-warm-white transition hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40',
            mood === id &&
              'border-primary-comfy-yellow bg-primary-comfy-yellow font-medium text-primary-comfy-ink hover:bg-primary-comfy-yellow'
          )
        "
        @click="emit('pick', id)"
      >
        {{ lc(MOOD_LABELS[id], locale) }}
      </button>
    </div>
    <p class="text-[11px] text-primary-warm-gray">
      {{ lc('relight.mood.note', locale) }}
    </p>
  </div>
</template>
