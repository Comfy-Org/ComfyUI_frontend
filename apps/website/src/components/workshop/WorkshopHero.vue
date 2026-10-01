<script setup lang="ts">
import { useSlots } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import SplitReveal from './SplitReveal.vue'
import {
  workshopEyebrowClass,
  workshopHeadingClass
} from './workshopHeadingClasses'

// The copy arrives resolved, so the hero belongs to whichever catalogue renders
// it rather than to one section's translation table.
const {
  eyebrow,
  heading,
  subtitle,
  subtitleSpace = []
} = defineProps<{
  eyebrow?: string
  heading: string
  subtitle?: string
  subtitleSpace?: readonly string[]
}>()

const slots = useSlots()
</script>

<template>
  <header
    :class="
      cn(
        'relative isolate -mx-6 -mt-8 overflow-hidden px-6 pt-8 max-sm:-mt-5 max-sm:pt-5 lg:-mx-8 lg:-mt-12 lg:px-8 lg:pt-12',
        slots.default
          ? 'mb-8 max-sm:mb-5'
          : 'mb-6 pb-2 max-sm:mb-4 max-sm:pb-0 sm:short:pb-0'
      )
    "
    data-testid="workshop-hero"
  >
    <slot name="eyebrow">
      <p v-if="eyebrow" :class="workshopEyebrowClass">
        <SplitReveal :text="eyebrow" />
      </p>
    </slot>
    <h1 :class="workshopHeadingClass">
      <SplitReveal :text="heading" :delay="90" />
    </h1>
    <div
      class="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 sm:short:mt-3"
    >
      <p v-if="subtitle" class="grid text-lg text-primary-comfy-canvas/70">
        <span
          v-for="text in subtitleSpace"
          :key="text"
          class="invisible col-start-1 row-start-1"
          aria-hidden="true"
          data-testid="hero-subtitle-space"
          >{{ text }}</span
        >
        <span class="col-start-1 row-start-1">
          <SplitReveal :text="subtitle" :delay="260" :stagger="50" />
        </span>
      </p>
      <slot name="aside" />
    </div>

    <slot />
  </header>
</template>
