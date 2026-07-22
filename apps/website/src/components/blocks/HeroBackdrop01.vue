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

// Removing the reactive `autoplay` attribute only suppresses the *initial*
// play; it can't pause a video the browser has already started. That is
// exactly the SSR case: the server renders `autoplay` (it can't read the
// client's motion preference), the browser begins playback on parse, and the
// post-hydration attribute removal is too late. Pause on mount so
// reduced-motion users get the poster frame instead of a looping video.
const pauseIfReduced = (el: unknown) => {
  if (el instanceof HTMLVideoElement && reduceMotion.value) el.pause()
}

// On mobile the backdrop is an in-flow rounded card above the content; on
// desktop it is the full-bleed background behind it. A single element serves
// both roles via responsive classes — mobileBackdrop only swaps the source.
const sharedBackdropClass =
  'relative aspect-3/2 w-full rounded-3xl object-cover lg:absolute lg:inset-0 lg:aspect-auto lg:size-full lg:rounded-none'

// When both breakpoints use images, serve them from a single responsive <img>
// so the browser fetches only the source matching the viewport. Two
// `hidden`/`lg:hidden`-toggled <img> layers would each download (display:none
// does not stop the fetch), doubling the high-priority load on an
// LCP-critical hero. Videos or a mixed image/video pair can't collapse this
// way and fall back to breakpoint-toggled layers below.
const responsiveImage = computed(() => {
  if (backdrop?.type !== 'image') return null
  if (mobileBackdrop && mobileBackdrop.type !== 'image') return null
  const base = mobileBackdrop ?? backdrop
  return {
    src: base.src,
    alt: backdrop.alt ?? mobileBackdrop?.alt ?? '',
    // Larger-viewport source; omitted when one image serves both breakpoints.
    desktopSrc: mobileBackdrop ? backdrop.src : undefined
  }
})

// Fallback for videos and mixed image/video pairs: toggle assets by breakpoint.
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
  return [{ backdrop, class: sharedBackdropClass }]
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
    <div class="bg-primary-warm-white/60 relative overflow-hidden rounded-3xl">
      <slot name="backdrop">
        <picture v-if="responsiveImage" class="contents">
          <source
            v-if="responsiveImage.desktopSrc"
            :srcset="responsiveImage.desktopSrc"
            media="(min-width: 1024px)"
          />
          <img
            :src="responsiveImage.src"
            :alt="responsiveImage.alt"
            fetchpriority="high"
            decoding="async"
            :class="sharedBackdropClass"
          />
        </picture>

        <template v-else>
          <template v-for="(layer, i) in backdropLayers" :key="i">
            <video
              v-if="layer.backdrop.type === 'video'"
              :ref="pauseIfReduced"
              :src="layer.backdrop.src"
              :poster="layer.backdrop.poster"
              :aria-label="layer.backdrop.alt"
              :aria-hidden="layer.backdrop.alt ? undefined : true"
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
