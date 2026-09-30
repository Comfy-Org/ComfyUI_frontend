<script setup lang="ts">
import { ChevronDown, Layers, Maximize } from '@lucide/vue'

import type {
  AspectRatio,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
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

const {
  aspectOptions,
  resolutionOptions,
  takeOptions,
  aspectValue,
  resolutionValue,
  takesValue
} = useFormatMenus(
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
    <CinematicMenu
      v-model="takesValue"
      :options="takeOptions"
      :heading="tc('cinematic.output.takes', locale)"
      side="bottom"
      tooltip
      :trigger-class="FORMAT_TRIGGER_CLASS"
    >
      <Layers class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
      <span class="flex-1 text-left tabular-nums">×{{ takes }}</span>
      <ChevronDown class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
  </div>
</template>
