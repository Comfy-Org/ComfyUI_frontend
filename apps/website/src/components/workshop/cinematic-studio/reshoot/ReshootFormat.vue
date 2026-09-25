<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  ReshootAspect,
  ReshootSize
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import {
  RESHOOT_ASPECTS,
  RESHOOT_SIZES
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import CinematicMenu from '../CinematicMenu.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const aspect = defineModel<ReshootAspect>('aspect', { required: true })
const size = defineModel<ReshootSize>('size', { required: true })

const aspectLabel = (id: ReshootAspect) =>
  id === 'source' ? rc('reshoot.aspect.source', locale) : id
const aspectOptions = computed(() =>
  RESHOOT_ASPECTS.map((id) => ({ id, label: aspectLabel(id) }))
)
const aspectValue = computed({
  get: () => aspect.value,
  set: (id: string) => {
    const match = RESHOOT_ASPECTS.find((option) => option === id)
    if (match) aspect.value = match
  }
})

const blockClass =
  'flex flex-col gap-1 rounded-xl px-3 py-2 ring-1 ring-transparency-white-t8 ring-inset'
const captionClass = 'text-[11px] text-primary-warm-gray'
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <div :class="blockClass">
      <span :class="captionClass">{{ rc('reshoot.aspect', locale) }}</span>
      <CinematicMenu
        v-model="aspectValue"
        :options="aspectOptions"
        :heading="rc('reshoot.aspect', locale)"
        trigger-class="h-7 justify-between gap-1 px-0 text-[13px] text-primary-warm-white"
      >
        {{ aspectLabel(aspect) }}
      </CinematicMenu>
    </div>
    <div :class="blockClass">
      <span :class="captionClass">{{ rc('reshoot.size', locale) }}</span>
      <div
        class="grid h-7 grid-cols-2 gap-0.5"
        role="radiogroup"
        :aria-label="rc('reshoot.size', locale)"
      >
        <button
          v-for="option in RESHOOT_SIZES"
          :key="option"
          type="button"
          role="radio"
          :aria-checked="size === option"
          :title="rc(`reshoot.size.${option}`, locale)"
          :class="
            cn(
              'rounded-md text-xs transition-colors',
              size === option
                ? 'bg-primary-warm-white text-primary-comfy-ink'
                : 'text-primary-comfy-canvas hover:text-primary-warm-white'
            )
          "
          @click="size = option"
        >
          {{ option }}
        </button>
      </div>
      <span :class="captionClass">{{
        rc(`reshoot.size.${size}`, locale)
      }}</span>
    </div>
  </div>
</template>
