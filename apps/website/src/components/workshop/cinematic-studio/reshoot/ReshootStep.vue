<script setup lang="ts">
import { Check } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { StepState } from './steps'

const { n, title, state } = defineProps<{
  n: number
  title: string
  state: StepState
}>()
</script>

<template>
  <section
    :aria-label="title"
    :aria-current="state === 'current' ? 'step' : undefined"
    :data-step-state="state"
    class="flex flex-col border-t border-transparency-white-t8 first:border-t-0"
  >
    <header class="flex min-h-13 items-center gap-3 py-2 pr-2 pl-5">
      <span
        :class="
          cn(
            'grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums',
            state === 'current' &&
              'bg-primary-comfy-yellow text-primary-comfy-ink',
            state === 'done' &&
              'bg-transparency-white-t20 text-primary-warm-white',
            state === 'next' &&
              'text-primary-warm-gray ring-1 ring-transparency-white-t20 ring-inset'
          )
        "
        aria-hidden="true"
      >
        <Check v-if="state === 'done'" class="size-3" />
        <template v-else>{{ n }}</template>
      </span>
      <h2
        :class="
          cn(
            'text-sm font-semibold',
            state === 'next'
              ? 'text-primary-warm-gray'
              : 'text-primary-warm-white'
          )
        "
      >
        {{ title }}
      </h2>
      <slot name="aside" />
    </header>
    <div class="flex flex-col gap-4 px-4 pb-4">
      <slot />
    </div>
  </section>
</template>
