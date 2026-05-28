<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

type Step = { id: string; label: string; description: string }

defineProps<{
  heading: string
  steps: readonly Step[]
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <h2
      class="text-primary-comfy-canvas mb-12 text-center text-4xl font-light tracking-tight lg:mb-16 lg:text-6xl"
    >
      {{ heading }}
    </h2>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        :class="
          cn(
            'border-primary-comfy-yellow rounded-3xl border p-8 lg:p-10',
            index === steps.length - 1 && steps.length % 2 === 1
              ? 'lg:col-span-2'
              : ''
          )
        "
      >
        <span
          class="bg-primary-comfy-yellow text-primary-comfy-ink font-formula-narrow inline-block -skew-x-12 rounded-sm px-3 py-1.5 text-sm font-bold tracking-wide uppercase lg:text-base"
        >
          <span class="ppformula-text-center inline-block skew-x-12">
            {{ index + 1 }}. {{ step.label }}
          </span>
        </span>
        <p class="text-primary-comfy-canvas mt-6 text-sm/relaxed lg:text-base">
          {{ step.description }}
        </p>
      </div>
    </div>
  </section>
</template>
