<script setup lang="ts">
import { computed } from 'vue'

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
import { framedStyle } from './aspect-style'
import CinematicMenu from './CinematicMenu.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const aspect = defineModel<AspectRatio>('aspect', { required: true })
const resolution = defineModel<Resolution>('resolution', { required: true })
const takes = defineModel<number>('takes', { required: true })

const aspectOptions = computed(() =>
  ASPECT_RATIOS.map((ratio) => ({
    id: ratio.id,
    label: ratio.id,
    meta: tc(ratio.label, locale)
  }))
)
const resolutionOptions = RESOLUTIONS.map((option) => ({
  id: option.id,
  label: option.id
}))
const takeOptions = Array.from({ length: MAX_TAKES }, (_, index) => ({
  id: String(index + 1),
  label: `×${index + 1}`
}))

const aspectValue = computed({
  get: () => aspect.value,
  set: (id: string) => {
    const match = ASPECT_RATIOS.find((ratio) => ratio.id === id)
    if (match) aspect.value = match.id
  }
})
const resolutionValue = computed({
  get: () => resolution.value,
  set: (id: string) => {
    const match = RESOLUTIONS.find((option) => option.id === id)
    if (match) resolution.value = match.id
  }
})
const takesValue = computed({
  get: () => String(takes.value),
  set: (id: string) => {
    takes.value = Number(id)
  }
})

const segmentClass =
  'h-full gap-2 rounded-none px-3 text-primary-comfy-canvas hover:bg-transparency-white-t4 hover:text-primary-warm-white data-[state=open]:text-primary-warm-white'
</script>

<template>
  <div
    role="group"
    :aria-label="tc('cinematic.composer.format', locale)"
    class="flex h-9 shrink-0 items-center overflow-hidden rounded-xl text-[13px] whitespace-nowrap ring-1 ring-transparency-white-t8 ring-inset"
  >
    <CinematicMenu
      v-model="aspectValue"
      :options="aspectOptions"
      :heading="tc('cinematic.output.aspect', locale)"
      :trigger-class="segmentClass"
      tooltip
    >
      <span class="grid size-4 place-items-center" aria-hidden="true">
        <span
          class="block max-h-full rounded-xs border-[1.5px] border-current"
          :style="framedStyle(aspect, '1rem')"
        />
      </span>
      {{ aspect }}
    </CinematicMenu>
    <span class="h-4 w-px bg-transparency-white-t8" aria-hidden="true" />
    <CinematicMenu
      v-model="resolutionValue"
      :options="resolutionOptions"
      :heading="tc('cinematic.output.resolution', locale)"
      :trigger-class="segmentClass"
      tooltip
    >
      {{ resolution }}
    </CinematicMenu>
    <span class="h-4 w-px bg-transparency-white-t8" aria-hidden="true" />
    <CinematicMenu
      v-model="takesValue"
      :options="takeOptions"
      :heading="tc('cinematic.output.takes', locale)"
      :trigger-class="segmentClass"
      tooltip
    >
      ×{{ takes }}
    </CinematicMenu>
  </div>
</template>
