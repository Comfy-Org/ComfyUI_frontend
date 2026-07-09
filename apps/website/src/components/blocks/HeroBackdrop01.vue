<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import ProductHeroBadge from '../common/ProductHeroBadge.vue'

type Backdrop =
  | { type: 'image'; src: string; alt?: string }
  | { type: 'video'; src: string; poster?: string; alt?: string }

const {
  backdrop,
  mobileBackdrop,
  badgeText,
  badgeLogoSrc,
  badgeLogoAlt,
  title,
  subtitle,
  footnote,
  class: className
} = defineProps<{
  backdrop?: Backdrop
  mobileBackdrop?: Backdrop
  badgeText?: string
  badgeLogoSrc?: string
  badgeLogoAlt?: string
  title: string
  subtitle?: string
  footnote?: string
  class?: HTMLAttributes['class']
}>()

// Respect prefers-reduced-motion: don't autoplay the looping backdrop video
// (WCAG 2.2.2). The paused video falls back to its poster/first frame.
const reduceMotion = computed(() => prefersReducedMotion())

// On mobile the backdrop is an in-flow rounded card above the content; on
// desktop it is the full-bleed background behind it. When a distinct
// mobileBackdrop is supplied, render both assets and toggle by breakpoint;
// otherwise a single element serves both roles responsively.
const backdropLayers = computed(() => {
  if (!backdrop) return []
  if (mobileBackdrop) {
    return [
      {
        backdrop: mobileBackdrop,
        class: 'relative aspect-3/2 w-full rounded-3xl object-cover lg:hidden'
      },
      {
        backdrop,
        class: 'absolute inset-0 hidden size-full object-cover lg:block'
      }
    ]
  }
  return [
    {
      backdrop,
      class:
        'relative aspect-3/2 w-full rounded-3xl object-cover lg:absolute lg:inset-0 lg:aspect-auto lg:size-full lg:rounded-none'
    }
  ]
})

const scrimShape = 'farthest-side at 50% 50%'
const scrimStyle = {
  background: `radial-gradient(${scrimShape}, color-mix(in srgb, var(--color-primary-warm-white) 80%, transparent) 0%, transparent 80%)`,
  maskImage: `radial-gradient(${scrimShape}, #000 45%, transparent 90%)`,
  WebkitMaskImage: `radial-gradient(${scrimShape}, #000 45%, transparent 90%)`
}
</script>

<template>
  <section
    :class="cn('max-w-9xl mx-auto px-4 pt-4 lg:px-6 lg:pt-6', className)"
  >
    <div class="relative overflow-hidden rounded-3xl">
      <slot name="backdrop">
        <template v-for="(layer, i) in backdropLayers" :key="i">
          <video
            v-if="layer.backdrop.type === 'video'"
            :src="layer.backdrop.src"
            :poster="layer.backdrop.poster"
            :aria-label="layer.backdrop.alt"
            :autoplay="!reduceMotion"
            loop
            muted
            playsinline
            preload="metadata"
            :class="layer.class"
          />
          <img
            v-else
            :src="layer.backdrop.src"
            :alt="layer.backdrop.alt ?? ''"
            fetchpriority="high"
            decoding="async"
            :class="layer.class"
          />
        </template>
      </slot>

      <div
        class="relative flex flex-col justify-center px-0 pt-6 pb-8 lg:min-h-176 lg:px-16 lg:py-24"
      >
        <div class="relative w-full max-w-xl">
          <div
            aria-hidden="true"
            class="pointer-events-none absolute -inset-12 hidden backdrop-blur-md lg:-inset-16 lg:block"
            :style="scrimStyle"
          />

          <div class="relative">
            <ProductHeroBadge
              v-if="badgeText"
              :text="badgeText"
              :logo-src="badgeLogoSrc"
              :logo-alt="badgeLogoAlt"
            />

            <h1
              class="mt-10 text-4xl/tight font-light tracking-tight whitespace-pre-line text-primary-comfy-canvas lg:text-6xl/tight lg:text-primary-comfy-ink"
            >
              {{ title }}
            </h1>

            <p
              v-if="subtitle"
              class="mt-8 max-w-md text-base text-primary-comfy-canvas lg:text-lg lg:text-primary-comfy-ink"
            >
              {{ subtitle }}
            </p>

            <p
              v-if="footnote"
              class="mt-10 text-sm text-primary-comfy-canvas lg:text-primary-comfy-ink"
            >
              {{ footnote }}
            </p>

            <slot />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
