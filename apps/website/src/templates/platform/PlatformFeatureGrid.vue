<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import SectionHeader from '../../components/common/SectionHeader.vue'

interface FeatureCard {
  title: string
  description: string
  link?: { label: string; href: string; suffix?: string }
}

const { columns = 3 } = defineProps<{
  heading: string
  subtitle?: string
  cards: readonly FeatureCard[]
  columns?: 3 | 4
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
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
      <article
        v-for="card in cards"
        :key="card.title"
        class="rounded-3xl border border-white/10 bg-transparency-white-t4 p-5 lg:p-6"
      >
        <h3 class="text-base font-normal text-primary-warm-white">
          {{ card.title }}
        </h3>
        <p class="mt-2 text-xs/relaxed font-light text-primary-comfy-canvas">
          {{ card.description
          }}<template v-if="card.link"
            ><a
              :href="card.link.href"
              class="text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 rounded-sm underline underline-offset-2 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
              >{{ card.link.label }}</a
            >{{ card.link.suffix }}</template
          >
        </p>
      </article>
    </div>
  </section>
</template>
