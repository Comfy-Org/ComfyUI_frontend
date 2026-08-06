<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'

import NodeGradientSlider from './NodeGradientSlider.vue'

const hue = defineModel<number>('hue', { default: 0 })
const saturation = defineModel<number>('saturation', { default: 1 })

/** One settle window across both values: the idle demo eases hue and
 * saturation as a single gesture, so both overlays must appear and fade at
 * the same instant rather than each slider timing out on its own. The demo
 * snaps eased values once within a rounding step of target, which caps the
 * gap between updates at ~160ms — the settle window sits above that. */
const moving = ref(false)
let settleTimer: ReturnType<typeof setTimeout> | undefined
watch([hue, saturation], () => {
  moving.value = true
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => (moving.value = false), 250)
})
onScopeDispose(() => clearTimeout(settleTimer))

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
          class="font-formula ppformula-text-center text-[0.7em] leading-[1.1] font-bold tracking-[-0.01em] text-primary-comfy-canvas"
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
        :moving
      />
      <NodeGradientSlider
        v-model="saturation"
        label="SATURATION"
        :min="0"
        :max="2"
        :step="0.05"
        :track="saturationTrack"
        :value-text="`${Math.round(saturation * 100)}%`"
        :moving
      />
    </div>
  </div>
</template>
