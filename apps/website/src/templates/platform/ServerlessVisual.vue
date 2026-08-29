<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

// Abstract autoscaling visual: one endpoint on the left, a fleet of GPU
// worker cells lighting up in a wave that radiates outward from it.
const COLS = 12
const ROWS = 6

interface Cell {
  id: number
  delay: string
  duration: string
}

const cells: Cell[] = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const distance = col + Math.abs(row - (ROWS - 1) / 2)
  return {
    id: i,
    delay: `${(distance * 0.16).toFixed(2)}s`,
    duration: `${(2.4 + (i % 3) * 0.4).toFixed(1)}s`
  }
})

// The hardware lineup flashes through on a shared CSS cycle: each label owns
// a quarter of the 7.2s label-flash keyframe via its animation delay.
const GPUS = ['RTX 6000 PRO', '5090', 'B200', 'H100']
const GPU_SLOT_SECONDS = 1.8
</script>

<template>
  <div
    aria-hidden="true"
    class="relative flex h-full min-h-72 items-center gap-6 overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-8 lg:gap-8 lg:p-10"
  >
    <!-- The endpoint: a single steady node with a ripple -->
    <svg viewBox="0 0 48 48" class="size-12 shrink-0">
      <circle
        cx="24"
        cy="24"
        r="10"
        class="animate-ripple fill-none stroke-primary-comfy-yellow/60"
      />
      <circle cx="24" cy="24" r="10" class="fill-primary-comfy-yellow" />
    </svg>

    <!-- Faint link from the endpoint into the fleet -->
    <svg viewBox="0 0 40 8" class="w-10 shrink-0" preserveAspectRatio="none">
      <line
        x1="0"
        y1="4"
        x2="40"
        y2="4"
        class="animate-dash-flow stroke-primary-comfy-canvas/40"
        stroke-width="1.5"
        stroke-dasharray="4 6"
      />
    </svg>

    <!-- The worker fleet, scaling out in a wave -->
    <div
      class="grid flex-1 gap-2"
      :style="{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }"
    >
      <div
        v-for="cell in cells"
        :key="cell.id"
        class="animate-gpu-pulse aspect-square rounded-sm bg-primary-comfy-yellow"
        :style="{
          animationDelay: cell.delay,
          animationDuration: cell.duration
        }"
      />
    </div>

    <!-- The hardware the fleet is running on, flashing through the lineup -->
    <span
      v-for="(gpu, index) in GPUS"
      :key="gpu"
      :class="
        cn(
          'animate-label-flash text-primary-comfy-yellow/80 absolute right-5 bottom-4 font-mono text-[10px] tracking-widest uppercase',
          index === 0 ? 'motion-reduce:opacity-100' : 'motion-reduce:hidden'
        )
      "
      :style="{ animationDelay: `${index * GPU_SLOT_SECONDS}s` }"
    >
      {{ gpu }}
    </span>
  </div>
</template>
