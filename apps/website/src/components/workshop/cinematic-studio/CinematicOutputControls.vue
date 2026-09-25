<script setup lang="ts">
import { Maximize, Minus, Plus } from '@lucide/vue'
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

const { locale = 'en', allowedAspects } = defineProps<{
  locale?: Locale
  allowedAspects?: readonly string[]
}>()

const aspect = defineModel<AspectRatio>('aspect', { required: true })
const resolution = defineModel<Resolution>('resolution', { required: true })
const takes = defineModel<number>('takes', { required: true })

const aspectOptions = computed(() =>
  ASPECT_RATIOS.filter(
    (ratio) => !allowedAspects || allowedAspects.includes(ratio.id)
  ).map((ratio) => ({
    id: ratio.id,
    label: ratio.id,
    meta: tc(ratio.label, locale)
  }))
)
const resolutionOptions = RESOLUTIONS.map((option) => ({
  id: option.id,
  label: option.id
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
</script>

<template>
  <div class="grid grid-cols-[auto_1fr_1fr] gap-2">
    <div
      class="flex h-10 items-center rounded-xl border border-transparency-white-t20"
      role="group"
      :aria-label="tc('cinematic.output.takes', locale)"
    >
      <button
        type="button"
        class="grid size-9 place-items-center text-primary-warm-gray hover:text-primary-warm-white disabled:opacity-40"
        :disabled="takes <= 1"
        :aria-label="tc('cinematic.output.fewerTakes', locale)"
        @click="takes = takes - 1"
      >
        <Minus class="size-3.5" aria-hidden="true" />
      </button>
      <span
        class="w-4 text-center text-sm text-primary-warm-white tabular-nums"
      >
        {{ takes }}
      </span>
      <button
        type="button"
        class="grid size-9 place-items-center text-primary-warm-gray hover:text-primary-warm-white disabled:opacity-40"
        :disabled="takes >= MAX_TAKES"
        :aria-label="tc('cinematic.output.moreTakes', locale)"
        @click="takes = takes + 1"
      >
        <Plus class="size-3.5" aria-hidden="true" />
      </button>
    </div>
    <CinematicMenu
      v-model="aspectValue"
      :options="aspectOptions"
      :heading="tc('cinematic.output.aspect', locale)"
      trigger-class="h-10 justify-center gap-1.5 border border-transparency-white-t20 text-sm text-primary-warm-white hover:border-primary-warm-white/50"
    >
      <span class="grid size-3.5 place-items-center" aria-hidden="true">
        <span
          class="block max-h-full rounded-xs border-[1.5px] border-primary-warm-gray"
          :style="framedStyle(aspect, '0.875rem')"
        />
      </span>
      {{ aspect }}
    </CinematicMenu>
    <CinematicMenu
      v-model="resolutionValue"
      :options="resolutionOptions"
      :heading="tc('cinematic.output.resolution', locale)"
      trigger-class="h-10 justify-center gap-1.5 border border-transparency-white-t20 text-sm text-primary-warm-white hover:border-primary-warm-white/50"
    >
      <Maximize class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
      {{ resolution }}
    </CinematicMenu>
  </div>
</template>
