<script setup lang="ts">
import { computed } from 'vue'

import { azimuthLabel, distanceLabel, elevationLabel } from './cameraVocabulary'

const { azimuth, elevation, zoom } = defineProps<{
  azimuth: number
  elevation: number
  zoom: number
}>()

const chips = computed(() => [
  { text: azimuthLabel(azimuth), tilt: '-rotate-[1.5deg]' },
  { text: elevationLabel(elevation), tilt: 'rotate-[1deg]' },
  { text: distanceLabel(zoom), tilt: '-rotate-[0.5deg]' }
])
</script>

<template>
  <p class="flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
    <span class="sr-only"
      >Prompt: {{ chips.map((c) => c.text).join(' ') }}</span
    >
    <span
      aria-hidden="true"
      class="text-primary-comfy-yellow/50 mr-1 font-mono text-sm lg:text-base"
    >
      &lt;sks&gt;
    </span>
    <span
      v-for="chip in chips"
      :key="chip.text"
      aria-hidden="true"
      :class="chip.tilt"
      class="bg-primary-comfy-yellow font-formula inline-block rounded-[0.2em] px-3 py-1 text-xl font-bold tracking-tight text-primary-comfy-ink uppercase lg:text-3xl"
    >
      {{ chip.text }}
    </span>
  </p>
</template>
