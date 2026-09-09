<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import SectionHeader from '../../components/common/SectionHeader.vue'
import type { FeatureCardLink } from './FeatureCard.vue'
import FeatureCard from './FeatureCard.vue'

interface FeatureCardData {
  title: string
  description: string
  link?: FeatureCardLink
}

const { columns = 3 } = defineProps<{
  id?: string
  heading: string
  subtitle?: string
  cards: readonly FeatureCardData[]
  columns?: 3 | 4
}>()
</script>

<template>
  <section
    :id
    class="max-w-9xl mx-auto scroll-mt-24 px-6 py-10 lg:scroll-mt-36 lg:py-14"
  >
    <SectionHeader max-width="xl" heading-size="compact">
      {{ heading }}
      <template v-if="subtitle" #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-smoke-700">
          {{ subtitle }}
        </p>
      </template>
    </SectionHeader>

    <div
      :class="
        cn(
          'mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2',
          columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        )
      "
    >
      <FeatureCard
        v-for="card in cards"
        :key="card.title"
        :title="card.title"
        :description="card.description"
        :link="card.link"
      />
    </div>

    <slot name="footer" />
  </section>
</template>
