<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import GlassCard from '../common/GlassCard.vue'

interface CompareRow {
  id: string
  feature: string
  cells: readonly string[]
}

const {
  heading,
  subtitle,
  featureLabel = 'FEATURE',
  columns,
  rows,
  class: className
} = defineProps<{
  heading: string
  subtitle?: string
  featureLabel?: string
  columns: readonly string[]
  rows: readonly CompareRow[]
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <h2
      class="text-center text-4xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
    >
      {{ heading }}
    </h2>
    <p
      v-if="subtitle"
      class="mx-auto mt-6 max-w-2xl text-center text-base font-light text-primary-comfy-canvas/70"
    >
      {{ subtitle }}
    </p>

    <GlassCard class="mx-auto mt-12 max-w-7xl lg:mt-16">
      <div
        class="scrollbar-none overflow-x-auto rounded-4xl bg-primary-comfy-ink"
      >
        <table class="w-full min-w-2xl text-left">
          <thead>
            <tr>
              <th
                scope="col"
                class="text-primary-comfy-yellow w-1/2 px-8 pt-8 pb-4 font-mono text-sm font-bold tracking-wide"
              >
                {{ featureLabel }}
              </th>
              <th
                v-for="column in columns"
                :key="column"
                scope="col"
                class="text-primary-comfy-yellow px-8 pt-8 pb-4 font-mono text-sm font-bold tracking-wide"
              >
                {{ column }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary-warm-white/10">
            <tr v-for="row in rows" :key="row.id">
              <th
                scope="row"
                class="px-8 py-6 text-base font-normal text-primary-warm-white lg:text-lg"
              >
                {{ row.feature }}
              </th>
              <td
                v-for="(cell, cellIndex) in row.cells"
                :key="cellIndex"
                class="px-8 py-6 text-base font-light text-primary-comfy-canvas/70 lg:text-lg"
              >
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GlassCard>
  </section>
</template>
