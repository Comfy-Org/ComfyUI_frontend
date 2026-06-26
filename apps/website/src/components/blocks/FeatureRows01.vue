<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import GlassCard from '../common/GlassCard.vue'
import SectionHeader from '../common/SectionHeader.vue'

export interface FeatureRow {
  id: string
  title: string
  description: string
  image: string
  imageAlt?: string
}

defineProps<{
  heading: string
  eyebrow?: string
  rows: readonly FeatureRow[]
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <SectionHeader :label="eyebrow" max-width="xl">
      {{ heading }}
    </SectionHeader>

    <div class="mt-16 flex flex-col gap-4 lg:gap-6">
      <GlassCard
        v-for="(row, i) in rows"
        :key="row.id"
        class="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-0"
      >
        <!-- Text -->
        <div
          :class="
            cn(
              'order-2 flex flex-col justify-center gap-4 p-6 lg:w-1/2 lg:p-12',
              i % 2 === 0 ? 'lg:order-1' : 'lg:order-2'
            )
          "
        >
          <h3 class="text-2xl font-light text-primary-comfy-canvas lg:text-3xl">
            {{ row.title }}
          </h3>
          <p class="text-sm text-smoke-700 lg:text-base">
            {{ row.description }}
          </p>
        </div>

        <!-- Image -->
        <div
          :class="
            cn('order-1 lg:w-1/2', i % 2 === 0 ? 'lg:order-2' : 'lg:order-1')
          "
        >
          <img
            :src="row.image"
            :alt="row.imageAlt ?? row.title"
            loading="lazy"
            decoding="async"
            class="aspect-4/3 w-full rounded-4xl object-cover"
          />
        </div>
      </GlassCard>
    </div>
  </section>
</template>
