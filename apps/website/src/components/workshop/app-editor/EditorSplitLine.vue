<script setup lang="ts">
import { ChevronsLeftRight } from '@lucide/vue'

const { beforeLabel, afterLabel, sliderLabel } = defineProps<{
  beforeLabel: string
  afterLabel: string
  sliderLabel: string
}>()

const split = defineModel<number>({ required: true })
</script>

<template>
  <input
    v-model.number="split"
    type="range"
    min="0"
    max="100"
    :aria-label="sliderLabel"
    class="peer absolute inset-0 z-10 size-full cursor-ew-resize touch-none opacity-0"
  />
  <span
    class="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-primary-warm-white shadow-[0_0_6px_rgb(0_0_0/0.5)]"
    :style="{ left: `${split}%` }"
    aria-hidden="true"
  />
  <span
    class="pointer-events-none absolute top-1/2 z-10 grid size-8 -translate-1/2 place-items-center rounded-full bg-primary-warm-white text-primary-comfy-ink shadow-lg shadow-black/40 peer-focus-visible:ring-3 peer-focus-visible:ring-primary-comfy-yellow/70"
    :style="{ left: `${split}%` }"
    aria-hidden="true"
  >
    <ChevronsLeftRight class="size-4" />
  </span>
  <span
    class="pointer-events-none absolute top-2.5 left-2.5 z-10 rounded-full bg-primary-comfy-ink/75 px-2 py-0.5 text-[10px] text-primary-warm-white"
    >{{ beforeLabel }}</span
  >
  <span
    class="pointer-events-none absolute top-2.5 right-2.5 z-10 rounded-full bg-primary-comfy-ink/75 px-2 py-0.5 text-[10px] text-primary-warm-white"
    >{{ afterLabel }}</span
  >
</template>
