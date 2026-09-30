<script setup lang="ts">
import { ChevronDown, Maximize, Minus, Plus } from '@lucide/vue'

import type {
  AspectRatio,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
import { MAX_TAKES } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { framedStyle } from './aspect-style'
import { FORMAT_TRIGGER_CLASS } from './cinematic-menu-trigger'
import CinematicMenu from './CinematicMenu.vue'
import { useFormatMenus } from './useFormatMenus'

const { locale = 'en', aspects } = defineProps<{
  locale?: Locale
  /** The frames the chosen model can make; every frame when absent. */
  aspects?: readonly AspectRatio[]
}>()

const aspect = defineModel<AspectRatio>('aspect', { required: true })
const resolution = defineModel<Resolution>('resolution', { required: true })
const takes = defineModel<number>('takes', { required: true })

const { aspectOptions, resolutionOptions, aspectValue, resolutionValue } =
  useFormatMenus(
    aspect,
    resolution,
    takes,
    () => locale,
    () => aspects
  )
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
      :trigger-class="FORMAT_TRIGGER_CLASS"
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
      :trigger-class="FORMAT_TRIGGER_CLASS"
    >
      <Maximize class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
      <span class="flex-1 text-left">{{ resolution }}</span>
      <ChevronDown class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
    <div
      role="group"
      :aria-label="tc('cinematic.output.takes', locale)"
      :title="tc('cinematic.output.takes', locale)"
      class="flex h-10 items-center justify-between rounded-xl border border-transparency-white-t8 px-1"
    >
      <button
        type="button"
        class="grid size-8 place-items-center rounded-lg text-primary-warm-gray outline-none hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 disabled:opacity-40"
        :disabled="takes <= 1"
        :aria-label="tc('cinematic.output.fewerTakes', locale)"
        @click="takes = Math.max(1, takes - 1)"
      >
        <Minus class="size-3.5" aria-hidden="true" />
      </button>
      <span
        class="text-sm text-primary-warm-white tabular-nums"
        aria-live="polite"
        data-testid="cinematic-takes"
      >
        {{ takes }}
      </span>
      <button
        type="button"
        class="grid size-8 place-items-center rounded-lg text-primary-warm-gray outline-none hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 disabled:opacity-40"
        :disabled="takes >= MAX_TAKES"
        :aria-label="tc('cinematic.output.moreTakes', locale)"
        @click="takes = Math.min(MAX_TAKES, takes + 1)"
      >
        <Plus class="size-3.5" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
