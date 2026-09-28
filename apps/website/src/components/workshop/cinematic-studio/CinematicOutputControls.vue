<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  AspectRatio,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
import {
  ASPECT_RATIOS,
  MAX_TAKES,
  RESOLUTIONS
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicTooltip from './CinematicTooltip.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const aspect = defineModel<AspectRatio>('aspect', { required: true })
const resolution = defineModel<Resolution>('resolution', { required: true })
const takes = defineModel<number>('takes', { required: true })

const trackClass =
  'flex h-10 items-center gap-0.5 rounded-xl bg-transparency-white-t4 p-1 ring-1 ring-transparency-white-t8 ring-inset'
const optionClass = (chosen: boolean) =>
  cn(
    'h-full min-w-0 flex-1 rounded-lg px-2 text-sm tabular-nums transition-colors',
    chosen
      ? 'bg-primary-warm-white font-medium text-primary-comfy-ink'
      : 'text-primary-warm-gray hover:text-primary-warm-white'
  )
const stepClass =
  'grid h-full w-8 place-items-center rounded-lg text-primary-warm-gray transition-colors hover:bg-transparency-white-t8 hover:text-primary-warm-white disabled:pointer-events-none disabled:opacity-40'
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      role="radiogroup"
      :aria-label="tc('cinematic.output.aspect', locale)"
      :class="trackClass"
    >
      <CinematicTooltip
        v-for="ratio in ASPECT_RATIOS"
        :key="ratio.id"
        :text="tc(ratio.label, locale)"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="aspect === ratio.id"
          :class="optionClass(aspect === ratio.id)"
          @click="aspect = ratio.id"
        >
          {{ ratio.id }}
        </button>
      </CinematicTooltip>
    </div>
    <div class="flex gap-2">
      <div
        role="radiogroup"
        :aria-label="tc('cinematic.output.resolution', locale)"
        :class="cn(trackClass, 'flex-1')"
      >
        <button
          v-for="option in RESOLUTIONS"
          :key="option.id"
          type="button"
          role="radio"
          :aria-checked="resolution === option.id"
          :class="optionClass(resolution === option.id)"
          @click="resolution = option.id"
        >
          {{ option.id }}
        </button>
      </div>
      <div
        role="group"
        :aria-label="tc('cinematic.output.takes', locale)"
        :class="trackClass"
      >
        <button
          type="button"
          :class="stepClass"
          :disabled="takes <= 1"
          :aria-label="tc('cinematic.output.fewerTakes', locale)"
          @click="takes = takes - 1"
        >
          <Minus class="size-3.5" aria-hidden="true" />
        </button>
        <span
          class="w-6 text-center text-sm font-medium text-primary-warm-white tabular-nums"
        >
          {{ takes }}
        </span>
        <button
          type="button"
          :class="stepClass"
          :disabled="takes >= MAX_TAKES"
          :aria-label="tc('cinematic.output.moreTakes', locale)"
          @click="takes = takes + 1"
        >
          <Plus class="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>
