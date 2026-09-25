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
    aspect.value =
      RESHOOT_ASPECTS.find((option) => option === id) ?? aspect.value
  }
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="grid grid-cols-2 gap-2">
      <CinematicMenu
        v-model="aspectValue"
        :options="aspectOptions"
        :heading="rc('reshoot.aspect', locale)"
        trigger-class="h-10 justify-center border border-transparency-white-t20 text-sm text-primary-warm-white hover:border-primary-warm-white/50"
      >
        {{ aspectLabel(aspect) }}
      </CinematicMenu>
      <div
        class="grid grid-cols-2 rounded-xl border border-transparency-white-t20 p-0.5"
        role="radiogroup"
        :aria-label="rc('reshoot.size', locale)"
      >
        <button
          v-for="option in RESHOOT_SIZES"
          :key="option"
          type="button"
          role="radio"
          :aria-checked="size === option"
          :class="
            cn(
              'rounded-lg text-sm transition-colors',
              size === option
                ? 'bg-primary-warm-white text-page'
                : 'text-primary-comfy-canvas hover:text-primary-warm-white'
            )
          "
          @click="size = option"
        >
          {{ option }}
        </button>
      </div>
    </div>
    <p class="text-right text-[11px] text-primary-warm-gray">
      {{ rc(`reshoot.size.${size}`, locale) }}
    </p>
  </div>
</template>
