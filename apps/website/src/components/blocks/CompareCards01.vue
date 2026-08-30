<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

type CompareCard = { label: string; body: string }

const {
  heading,
  lead,
  cards,
  class: className
} = defineProps<{
  heading: string
  lead?: string
  cards: readonly CompareCard[]
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section
    :class="cn('max-w-9xl mx-auto px-6 py-16 lg:px-20 lg:py-24', className)"
  >
    <h2
      class="text-page-fg lg:text-6.5xl max-w-200 text-4xl leading-[1.3] font-medium tracking-[-0.03em] text-pretty md:text-5xl"
    >
      {{ heading }}
    </h2>

    <!-- Figma trims its text boxes to cap height, so the design's 48px gap is
         measured ink-to-ink; this margin is that gap less the half-leading CSS
         adds above the lead. -->
    <p
      v-if="lead"
      class="text-page-fg mt-6 max-w-160 text-[17px] leading-[1.6] font-light"
    >
      {{ lead }}
    </p>

    <div class="mt-12 grid gap-8 md:grid-cols-2">
      <article
        v-for="card in cards"
        :key="card.label"
        class="rounded-4.5xl bg-primary-comfy-ink/8 p-8 lg:px-10 lg:py-16"
      >
        <h3 class="text-primary-comfy-plum text-3xl leading-[1.35] font-medium">
          {{ card.label }}
        </h3>
        <p
          class="mt-4 text-[17px] leading-[1.6] font-light text-primary-comfy-ink"
        >
          {{ card.body }}
        </p>
      </article>
    </div>
  </section>
</template>
