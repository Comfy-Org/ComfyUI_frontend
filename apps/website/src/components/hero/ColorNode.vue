<script setup lang="ts">
import { computed } from 'vue'

import NodeGradientSlider from './NodeGradientSlider.vue'

const hue = defineModel<number>('hue', { default: 0 })
const saturation = defineModel<number>('saturation', { default: 1 })

const HUE_TRACK =
  'linear-gradient(to right, hsl(0 85% 55%), hsl(60 85% 55%), hsl(120 85% 55%), hsl(180 85% 55%), hsl(240 85% 55%), hsl(300 85% 55%), hsl(360 85% 55%))'

const saturationTrack = computed(
  () => `linear-gradient(to right, #6b6b6b, hsl(${hue.value} 85% 55%))`
)
</script>

<template>
  <div
    class="relative flex size-full flex-col rounded-[1.25em] border border-white/12 bg-[#242428]"
  >
    <div class="flex h-[2.25em] shrink-0 items-center px-[1.05em]">
      <span class="bg-primary-comfy-yellow size-[0.55em] rounded-full" />
      <span class="ml-auto flex items-center gap-[0.5em]">
        <span
          class="font-formula text-[0.7em] font-semibold tracking-[0.14em] text-white"
        >
          COLOR
        </span>
        <span class="bg-primary-comfy-yellow size-[0.55em] rounded-full" />
      </span>
    </div>

    <div
      class="flex min-h-0 flex-1 flex-col justify-center gap-[0.9em] px-[1.05em] pb-[1.05em]"
    >
      <NodeGradientSlider
        v-model="hue"
        label="HUE"
        :min="0"
        :max="360"
        :step="1"
        :track="HUE_TRACK"
        :value-text="`${hue} degrees`"
      />
      <NodeGradientSlider
        v-model="saturation"
        label="SATURATION"
        :min="0"
        :max="2"
        :step="0.05"
        :track="saturationTrack"
        :value-text="`${Math.round(saturation * 100)}%`"
      />
    </div>
  </div>
</template>
