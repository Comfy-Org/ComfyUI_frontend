<script setup lang="ts">
import { Clapperboard, Download, Film, Volume2, Waypoints } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import type { ReshootSound, ReshootView } from './output'

const {
  href,
  fileName,
  locale = 'en'
} = defineProps<{
  href: string
  fileName: string
  locale?: Locale
}>()

const view = defineModel<ReshootView>('view', { required: true })
const sound = defineModel<ReshootSound>('sound', { required: true })

const VIEWS = [
  { id: 'result', icon: Clapperboard },
  { id: 'warp', icon: Waypoints },
  { id: 'source', icon: Film }
] as const
const SOUNDS: readonly ReshootSound[] = ['generated', 'original']

const optionClass = (active: boolean) =>
  cn(
    'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors',
    active
      ? 'bg-primary-warm-white text-primary-comfy-ink'
      : 'text-primary-comfy-canvas hover:bg-transparency-white-t8 hover:text-primary-warm-white'
  )
</script>

<template>
  <div class="flex w-full flex-wrap items-center justify-between gap-2">
    <div
      class="flex rounded-full bg-transparency-white-t4 p-1 ring-1 ring-transparency-white-t8 ring-inset"
      role="radiogroup"
      :aria-label="rc('reshoot.views', locale)"
    >
      <button
        v-for="option in VIEWS"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="view === option.id"
        :class="optionClass(view === option.id)"
        @click="view = option.id"
      >
        <component :is="option.icon" class="size-3.5" aria-hidden="true" />
        {{ rc(`reshoot.view.${option.id}`, locale) }}
      </button>
    </div>
    <div class="flex items-center gap-2">
      <div
        v-if="view === 'result'"
        class="flex items-center rounded-full bg-transparency-white-t4 p-1 pl-2.5 ring-1 ring-transparency-white-t8 ring-inset"
        role="radiogroup"
        :aria-label="rc('reshoot.sound', locale)"
      >
        <Volume2
          class="mr-1 size-3.5 text-primary-warm-gray"
          aria-hidden="true"
        />
        <button
          v-for="option in SOUNDS"
          :key="option"
          type="button"
          role="radio"
          :aria-checked="sound === option"
          :class="optionClass(sound === option)"
          @click="sound = option"
        >
          {{ rc(`reshoot.sound.${option}`, locale) }}
        </button>
      </div>
      <a
        :href
        :download="fileName"
        class="flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-primary-warm-white ring-1 ring-transparency-white-t20 transition-colors ring-inset hover:bg-transparency-white-t8"
      >
        <Download class="size-3.5" aria-hidden="true" />
        {{ rc('reshoot.download', locale) }}
      </a>
    </div>
  </div>
</template>
