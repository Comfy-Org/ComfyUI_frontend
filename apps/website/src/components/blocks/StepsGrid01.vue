<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import NodeUnionIcon from '../icons/NodeUnionIcon.vue'

type Step = { id: string; label: string; description: string }

defineProps<{
  heading: string
  steps: readonly Step[]
}>()

const isRtlRow = (i: number) => Math.floor(i / 2) % 2 === 1
const isFullSpan = (i: number, total: number) =>
  i === total - 1 && total % 2 === 1

function hasHorizontalConnector(i: number, total: number) {
  if (isFullSpan(i, total)) return false
  if (!isRtlRow(i) && i % 2 === 0 && i + 1 < total) return true
  if (isRtlRow(i) && i % 2 === 1) return true
  return false
}

function hasMobileVertical(i: number, total: number) {
  return i < total - 1
}

function hasLgVertical(i: number, total: number) {
  return i % 2 === 1 && i + 1 < total
}

function cardClass(i: number, total: number) {
  const fullSpan = isFullSpan(i, total)
  const rtl = isRtlRow(i)
  return cn(
    'border-primary-comfy-yellow relative rounded-3xl border-2 p-8 lg:p-10',
    fullSpan && 'lg:col-span-2',
    !fullSpan && rtl && i % 2 === 0 && 'lg:col-start-2',
    !fullSpan && rtl && i % 2 === 1 && 'lg:col-start-1'
  )
}
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <h2
      class="mb-12 text-center text-4xl font-light tracking-tight text-primary-comfy-canvas lg:mb-16 lg:text-6xl"
    >
      {{ heading }}
    </h2>

    <div
      class="mx-auto grid max-w-3xl grid-cols-1 gap-4 lg:grid-flow-dense lg:grid-cols-2"
    >
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        :class="cardClass(index, steps.length)"
      >
        <span
          class="bg-primary-comfy-yellow font-formula-narrow inline-block -skew-x-12 rounded-sm px-3 py-1.5 text-sm font-bold tracking-wide text-primary-comfy-ink uppercase lg:text-base"
        >
          <span class="inline-block skew-x-12">
            {{ index + 1 }}. {{ step.label }}
          </span>
        </span>
        <p class="mt-6 text-sm/relaxed text-primary-comfy-canvas lg:text-base">
          {{ step.description }}
        </p>

        <NodeUnionIcon
          v-if="hasHorizontalConnector(index, steps.length)"
          class="text-primary-comfy-yellow absolute top-1/2 right-0 hidden size-4 translate-x-[calc(100%+2px)] -translate-y-1/2 scale-x-150 rotate-90 lg:block"
        />
        <NodeUnionIcon
          v-if="
            hasMobileVertical(index, steps.length) ||
            hasLgVertical(index, steps.length)
          "
          :class="
            cn(
              'text-primary-comfy-yellow absolute bottom-0 left-1/2 size-4 -translate-x-1/2 translate-y-[calc(100%+2px)] scale-x-150',
              !hasMobileVertical(index, steps.length) && 'hidden lg:block',
              !hasLgVertical(index, steps.length) && 'lg:hidden'
            )
          "
        />
      </div>
    </div>
  </section>
</template>
