<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'

import type { ModelMediaTone } from './modelExploreFixtures'

const { tone } = defineProps<{
  tone: ModelMediaTone
}>()

const toneClass = computed(() => {
  const classes: Record<ModelMediaTone, string> = {
    forest:
      'from-illustration-forest via-primary-comfy-ink-light to-primary-comfy-plum/70',
    plum: 'from-primary-comfy-plum via-secondary-deep-plum to-primary-comfy-ink-light',
    ember:
      'from-primary-comfy-orange/70 via-secondary-mauve to-primary-comfy-ink',
    canvas:
      'from-primary-comfy-canvas/50 via-primary-warm-gray/40 to-secondary-deep-plum'
  }

  return classes[tone]
})
</script>

<template>
  <div
    aria-hidden="true"
    :class="
      cn(
        'rounded-4.5xl relative size-full overflow-hidden bg-linear-to-br',
        toneClass
      )
    "
  >
    <div
      class="border-primary-comfy-canvas/10 bg-primary-comfy-ink/20 absolute inset-8 rounded-3xl border"
    />
    <div
      class="border-primary-comfy-canvas/20 bg-primary-comfy-canvas/10 absolute top-12 left-12 h-12 w-28 rounded-xl border"
    />
    <div
      class="border-primary-comfy-yellow/20 bg-primary-comfy-yellow/10 absolute right-14 bottom-12 h-20 w-36 rounded-2xl border"
    />
    <div
      class="bg-primary-comfy-yellow/70 absolute top-24 right-28 size-3 rounded-full"
    />
    <div
      class="bg-primary-comfy-canvas/20 absolute bottom-20 left-32 h-px w-40 rotate-12"
    />
  </div>
</template>
