<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import ProductHeroBadge from '../common/ProductHeroBadge.vue'

type Backdrop =
  | { type: 'image'; src: string; alt?: string }
  | { type: 'video'; src: string; poster?: string; alt?: string }

const {
  backdrop,
  badgeText,
  badgeLogoSrc,
  badgeLogoAlt,
  title,
  subtitle,
  footnote,
  class: className
} = defineProps<{
  backdrop?: Backdrop
  badgeText?: string
  badgeLogoSrc?: string
  badgeLogoAlt?: string
  title: string
  subtitle?: string
  footnote?: string
  class?: HTMLAttributes['class']
}>()

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
        <video
          v-if="backdrop?.type === 'video'"
          :src="backdrop.src"
          :poster="backdrop.poster"
          :aria-label="backdrop.alt"
          autoplay
          loop
          muted
          playsinline
          preload="metadata"
          class="absolute inset-0 size-full object-cover"
        />
        <img
          v-else-if="backdrop?.type === 'image'"
          :src="backdrop.src"
          :alt="backdrop.alt ?? ''"
          fetchpriority="high"
          decoding="async"
          class="absolute inset-0 size-full object-cover"
        />
      </slot>

      <div
        class="relative flex min-h-[70svh] flex-col justify-center px-8 py-16 lg:min-h-176 lg:px-16 lg:py-24"
      >
        <div class="relative w-full max-w-xl">
          <div
            aria-hidden="true"
            class="pointer-events-none absolute -inset-12 backdrop-blur-md lg:-inset-16"
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
              class="mt-10 text-4xl/tight font-light tracking-tight whitespace-pre-line text-primary-comfy-ink lg:text-6xl/tight"
            >
              {{ title }}
            </h1>

            <p
              v-if="subtitle"
              class="mt-8 max-w-md text-base text-primary-comfy-ink lg:text-lg"
            >
              {{ subtitle }}
            </p>

            <p v-if="footnote" class="mt-10 text-sm text-primary-comfy-ink">
              {{ footnote }}
            </p>

            <slot />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
