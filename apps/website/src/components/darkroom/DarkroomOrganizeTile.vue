<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { DarkroomItem } from '@/lib/darkroom/store'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

import DarkroomStarIcon from './DarkroomStarIcon.vue'

const {
  item,
  url,
  selected,
  selecting,
  locale = 'en'
} = defineProps<{
  item: DarkroomItem
  url?: string
  selected: boolean
  /** Whether anything is selected, which keeps every tick in view. */
  selecting: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ toggle: [shiftKey: boolean]; open: [] }>()
</script>

<template>
  <div
    :title="item.settings.prompt"
    :class="
      cn(
        'group/tile relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-site-bg-soft select-none',
        selected && 'ring-3 ring-primary-warm-white ring-inset'
      )
    "
    role="checkbox"
    tabindex="0"
    :aria-checked="selected"
    @click="emit('toggle', $event.shiftKey)"
    @keydown.space.prevent="emit('toggle', $event.shiftKey)"
  >
    <img
      v-if="url"
      :src="url"
      alt=""
      loading="lazy"
      class="block size-full object-cover"
    />
    <span
      :class="
        cn(
          'absolute top-2 left-2 flex size-6 items-center justify-center rounded-full border-[1.5px] transition-opacity pointer-coarse:opacity-100',
          selected
            ? 'border-primary-warm-white bg-primary-warm-white text-primary-comfy-ink'
            : 'border-white/90 bg-primary-comfy-ink/45 text-transparent',
          selecting ? 'opacity-100' : 'opacity-0 group-hover/tile:opacity-100'
        )
      "
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        aria-hidden="true"
        class="size-3.5"
      >
        <path d="M3.5 8.5l3 3 6-6.5" />
      </svg>
    </span>
    <DarkroomStarIcon
      v-if="item.starred"
      filled
      class="absolute bottom-2 left-2 size-5 text-primary-comfy-yellow drop-shadow-md"
    />
    <button
      type="button"
      class="absolute top-2 right-2 size-8 cursor-pointer rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink/80 text-base text-primary-warm-white opacity-0 transition-opacity group-hover/tile:opacity-100 hover:bg-primary-warm-white hover:text-primary-comfy-ink focus-visible:opacity-100 pointer-coarse:opacity-100"
      :title="t('darkroom.organize.viewLarger')"
      :aria-label="t('darkroom.organize.viewLarger')"
      @click.stop="emit('open')"
    >
      ⤢
    </button>
  </div>
</template>
