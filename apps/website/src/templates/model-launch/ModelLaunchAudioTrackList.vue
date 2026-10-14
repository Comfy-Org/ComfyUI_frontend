<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchAudioCard } from './types'

import { translationsFor } from '@/i18n/translations'
import { formatClock } from '@/utils/formatClock'

const {
  locale = 'en',
  cards,
  selectedId
} = defineProps<{
  cards: readonly ModelLaunchAudioCard[]
  selectedId: string
  locale?: Locale
}>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = translationsFor(locale)

function trackTitle(card: ModelLaunchAudioCard) {
  const text = card.title ?? card.description
  return text[locale] || text.en
}

const trackNumber = (index: number) => String(index + 1).padStart(2, '0')
</script>

<template>
  <ol
    class="flex flex-col gap-1 rounded-4.5xl bg-primary-comfy-ink p-2 lg:col-span-2"
    :aria-label="t('modelLaunch.tracks')"
  >
    <li v-for="(card, index) in cards" :key="card.id">
      <button
        type="button"
        :aria-pressed="card.id === selectedId"
        :class="
          cn(
            'flex w-full cursor-pointer items-center gap-4 rounded-3xl px-4 py-3 text-left transition-colors',
            card.id === selectedId
              ? 'bg-primary-comfy-ink-light'
              : 'hover:bg-primary-comfy-ink-light/60'
          )
        "
        @click="emit('select', card.id)"
      >
        <span
          :class="
            cn(
              'w-6 shrink-0 text-sm font-extrabold tracking-wider',
              card.id === selectedId
                ? 'text-primary-comfy-yellow'
                : 'text-primary-warm-gray'
            )
          "
        >
          {{ trackNumber(index) }}
        </span>
        <span class="min-w-0 flex-1">
          <span
            :class="
              cn(
                'block truncate text-lg/snug font-medium',
                card.id === selectedId
                  ? 'text-primary-warm-white'
                  : 'text-primary-comfy-canvas'
              )
            "
          >
            {{ trackTitle(card) }}
          </span>
          <span
            v-if="card.voices?.length"
            class="block truncate text-sm font-light text-primary-warm-gray"
          >
            {{ card.voices.map((voice) => voice.name).join(' + ') }}
          </span>
        </span>
        <span
          v-if="card.durationSeconds"
          class="shrink-0 text-sm font-light text-primary-warm-gray tabular-nums"
        >
          {{ formatClock(card.durationSeconds) }}
        </span>
      </button>
    </li>
  </ol>
</template>
