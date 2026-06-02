<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import NodeUnionIcon from '../icons/NodeUnionIcon.vue'

type Step = { id: string; label: string; description: string }

defineProps<{
  heading: string
  steps: readonly Step[]
}>()

function isLastInRow(index: number, total: number): boolean {
  if (index === total - 1) return true
  return index % 2 === 1
}

function isInLastRow(index: number, total: number): boolean {
  if (index === total - 1) return true
  if (total % 2 === 0 && index === total - 2) return true
  return false
}

function hasRightConnector(index: number, total: number): boolean {
  return index % 2 === 0 && index + 1 < total
}

function hasBottomConnector(index: number, total: number): boolean {
  return isLastInRow(index, total) && !isInLastRow(index, total)
}
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <h2
      class="text-primary-comfy-canvas mb-12 text-center text-4xl font-light tracking-tight lg:mb-16 lg:text-6xl"
    >
      {{ heading }}
    </h2>

    <div class="mx-auto grid max-w-3xl grid-cols-1 gap-4 lg:grid-cols-2">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        :class="
          cn(
            'border-primary-comfy-yellow relative rounded-3xl border-2 p-8 lg:p-10',
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

        <NodeUnionIcon
          v-if="hasRightConnector(index, steps.length)"
          class="text-primary-comfy-yellow pointer-events-none absolute top-1/2 right-0 z-10 hidden h-12 w-16 translate-x-1/2 -translate-y-1/2 lg:block"
        />

        <NodeUnionIcon
          v-if="hasBottomConnector(index, steps.length)"
          class="text-primary-comfy-yellow pointer-events-none absolute bottom-0 left-1/2 z-10 hidden h-12 w-16 -translate-x-1/2 translate-y-1/2 rotate-90 lg:block"
        />
      </div>
    </div>
  </section>
</template>
