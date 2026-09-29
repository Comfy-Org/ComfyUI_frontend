<script setup lang="ts">
import { ChevronDown, Maximize } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  AspectRatio,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
import { MAX_TAKES } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { framedStyle } from './aspect-style'
import CinematicMenu from './CinematicMenu.vue'
import { useFormatMenus } from './useFormatMenus'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const aspect = defineModel<AspectRatio>('aspect', { required: true })
const resolution = defineModel<Resolution>('resolution', { required: true })
const takes = defineModel<number>('takes', { required: true })

const { aspectOptions, resolutionOptions, aspectValue, resolutionValue } =
  useFormatMenus(aspect, resolution, takes, () => locale)
const takeCounts = Array.from({ length: MAX_TAKES }, (_, index) => index + 1)

const triggerClass =
  'h-10 w-full gap-2 border border-transparency-white-t8 px-3 text-sm text-primary-warm-white hover:border-transparency-white-t20'
</script>

<template>
  <div
    role="group"
    :aria-label="tc('cinematic.section.output', locale)"
    class="grid grid-cols-3 gap-2"
  >
    <CinematicMenu
      v-model="aspectValue"
      :options="aspectOptions"
      :heading="tc('cinematic.output.aspect', locale)"
      side="bottom"
      tooltip
      :trigger-class="triggerClass"
    >
      <span class="grid size-4 place-items-center" aria-hidden="true">
        <span
          class="block max-h-full rounded-xs border-[1.5px] border-primary-warm-gray"
          :style="framedStyle(aspect, '1rem')"
        />
      </span>
      <span class="flex-1 text-left tabular-nums">{{ aspect }}</span>
      <ChevronDown class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
    <CinematicMenu
      v-model="resolutionValue"
      :options="resolutionOptions"
      :heading="tc('cinematic.output.resolution', locale)"
      side="bottom"
      tooltip
      :trigger-class="triggerClass"
    >
      <Maximize class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
      <span class="flex-1 text-left">{{ resolution }}</span>
      <ChevronDown class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
    <div
      role="radiogroup"
      :aria-label="tc('cinematic.output.takes', locale)"
      :title="tc('cinematic.output.takes', locale)"
      class="grid h-10 grid-cols-4 rounded-xl border border-transparency-white-t8 p-0.5"
    >
      <button
        v-for="count in takeCounts"
        :key="count"
        type="button"
        role="radio"
        :aria-checked="takes === count"
        :class="
          cn(
            'rounded-lg text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50',
            takes === count
              ? 'bg-primary-warm-white text-primary-comfy-ink'
              : 'text-primary-comfy-canvas hover:text-primary-warm-white'
          )
        "
        @click="takes = count"
      >
        {{ count }}
      </button>
    </div>
  </div>
</template>
