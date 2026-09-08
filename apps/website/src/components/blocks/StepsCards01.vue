<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import GlassCard from '../common/GlassCard.vue'

interface StepCard {
  id: string
  title: string
  description: string
}

const {
  heading,
  steps,
  class: className
} = defineProps<{
  heading: string
  steps: readonly StepCard[]
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <h2
      class="mb-12 text-center text-4xl font-light tracking-tight text-primary-comfy-canvas lg:mb-16 lg:text-5xl"
    >
      {{ heading }}
    </h2>

    <GlassCard>
      <div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
        <article
          v-for="step in steps"
          :key="step.id"
          class="flex flex-col rounded-4xl bg-primary-comfy-ink p-8 lg:min-h-96"
        >
          <h3 class="text-3xl font-light text-primary-comfy-canvas">
            {{ step.title }}
          </h3>
          <p
            class="mt-10 text-base font-light text-primary-comfy-canvas/70 lg:mt-20"
          >
            {{ step.description }}
          </p>
        </article>
      </div>
    </GlassCard>
  </section>
</template>
