<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import GlassCard from '../common/GlassCard.vue'
import SectionHeader from '../common/SectionHeader.vue'

type Step = { id: string; title: string; description: string }

type Media =
  | { type: 'image'; src: string; alt?: string }
  | { type: 'video'; src: string; poster?: string; alt?: string }

const {
  steps,
  media,
  heading,
  mediaPosition = 'right',
  class: className
} = defineProps<{
  steps: readonly Step[]
  media?: Media
  heading?: string
  mediaPosition?: 'left' | 'right'
  class?: HTMLAttributes['class']
}>()

function stepNumber(index: number) {
  return String(index + 1).padStart(2, '0')
}

// Respect prefers-reduced-motion: don't autoplay the looping media video
// (WCAG 2.2.2). The paused video falls back to its poster/first frame.
const reduceMotion = computed(() => prefersReducedMotion())
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <SectionHeader v-if="heading" class="mb-12 lg:mb-16">
      {{ heading }}
    </SectionHeader>

    <GlassCard>
      <div class="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 lg:gap-8">
        <ol class="flex flex-col gap-6 px-6 py-8 lg:px-10 lg:py-14">
          <li v-for="(step, index) in steps" :key="step.id">
            <p
              class="font-formula-narrow text-primary-comfy-yellow text-sm font-bold tracking-wide uppercase lg:text-base"
            >
              {{ stepNumber(index) }} {{ step.title }}
            </p>
            <p
              class="mt-2 text-sm/relaxed text-primary-comfy-canvas lg:text-base"
            >
              {{ step.description }}
            </p>
          </li>
        </ol>

        <div
          v-if="media || $slots.media"
          :class="
            cn(
              'relative aspect-video overflow-hidden rounded-4xl lg:aspect-auto',
              mediaPosition === 'left' && 'lg:order-first'
            )
          "
        >
          <slot name="media">
            <video
              v-if="media?.type === 'video'"
              :src="media.src"
              :poster="media.poster"
              :aria-label="media.alt"
              :autoplay="!reduceMotion"
              loop
              muted
              playsinline
              preload="metadata"
              class="absolute inset-0 size-full object-cover"
            />
            <img
              v-else-if="media?.type === 'image'"
              :src="media.src"
              :alt="media.alt ?? ''"
              decoding="async"
              class="absolute inset-0 size-full object-cover"
            />
          </slot>
        </div>
      </div>
    </GlassCard>
  </section>
</template>
