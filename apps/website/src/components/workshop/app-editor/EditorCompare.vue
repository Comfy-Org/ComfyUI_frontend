<script setup lang="ts">
import { ChevronsLeftRight } from '@lucide/vue'
import { ref } from 'vue'

import EditorFrame from './EditorFrame.vue'

const {
  before,
  after,
  alt,
  beforeLabel,
  afterLabel,
  sliderLabel,
  width,
  height
} = defineProps<{
  before: string
  after: string
  alt: string
  beforeLabel: string
  afterLabel: string
  sliderLabel: string
  width: number
  height: number
}>()

const split = ref(50)
</script>

<template>
  <EditorFrame :width :height>
    <div class="relative size-full overflow-hidden rounded-sm">
      <img :src="after" :alt class="absolute inset-0 size-full object-cover" />
      <img
        :src="before"
        alt=""
        class="absolute inset-0 size-full object-cover"
        :style="{ clipPath: `inset(0 ${100 - split}% 0 0)` }"
      />
      <span
        class="absolute top-2.5 left-2.5 rounded-full bg-primary-comfy-ink/75 px-2 py-0.5 text-[10px] text-primary-warm-white"
        >{{ beforeLabel }}</span
      >
      <span
        class="absolute top-2.5 right-2.5 rounded-full bg-primary-comfy-ink/75 px-2 py-0.5 text-[10px] text-primary-warm-white"
        >{{ afterLabel }}</span
      >
      <input
        v-model.number="split"
        type="range"
        min="0"
        max="100"
        :aria-label="sliderLabel"
        class="peer absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
      <span
        class="pointer-events-none absolute inset-y-0 w-px bg-primary-warm-white peer-focus-visible:*:ring-3 peer-focus-visible:*:ring-primary-comfy-yellow/60"
        :style="{ left: `${split}%` }"
        aria-hidden="true"
      >
        <span
          class="absolute top-1/2 left-1/2 grid size-7 -translate-1/2 place-items-center rounded-full bg-primary-warm-white text-primary-comfy-ink shadow-lg shadow-black/40"
        >
          <ChevronsLeftRight class="size-3.5" />
        </span>
      </span>
    </div>
  </EditorFrame>
</template>
