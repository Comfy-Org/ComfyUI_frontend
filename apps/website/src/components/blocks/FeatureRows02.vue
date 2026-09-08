<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

interface DefinitionRow {
  id: string
  term: string
  description: string
}

const {
  heading,
  rows,
  footnote,
  class: className
} = defineProps<{
  heading?: string
  rows: readonly DefinitionRow[]
  footnote?: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <h2
      v-if="heading"
      class="mb-12 text-center text-4xl font-light tracking-tight text-primary-comfy-canvas lg:mb-16 lg:text-5xl"
    >
      {{ heading }}
    </h2>

    <dl>
      <div
        v-for="row in rows"
        :key="row.id"
        class="flex flex-col gap-4 border-b border-primary-comfy-canvas/20 py-10 lg:flex-row lg:gap-12"
      >
        <dt
          class="shrink-0 text-2xl font-light text-primary-comfy-canvas lg:w-75"
        >
          {{ row.term }}
        </dt>
        <dd class="flex-1 text-base font-light text-primary-comfy-canvas/70">
          {{ row.description }}
        </dd>
      </div>
    </dl>

    <p
      v-if="footnote"
      class="mt-10 text-sm font-light text-primary-comfy-canvas/70 lg:mt-12"
    >
      {{ footnote }}
    </p>
  </section>
</template>
