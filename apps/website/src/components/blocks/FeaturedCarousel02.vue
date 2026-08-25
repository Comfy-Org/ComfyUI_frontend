<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  useDebounceFn,
  useElementHover,
  useEventListener,
  useIntersectionObserver
} from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'

import type { HTMLAttributes } from 'vue'

import type { Locale } from '../../i18n/translations'
import { useCarouselAutoplay } from '../../composables/useCarouselAutoplay'
import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { resolveRel } from '../../utils/cta'
import VideoPlayer from '../common/VideoPlayer.vue'
import Badge from '../ui/badge/Badge.vue'
import Button from '../ui/button/Button.vue'

type FeaturedSlideMedia = {
  type: 'image' | 'video'
  src: string
  alt: string
  poster?: string
}

type FeaturedSlideCta = {
  label: string
  href: string
  newTab?: boolean
}

export type FeaturedSplitSlide = {
  id: string
  media: FeaturedSlideMedia
  eyebrow?: string
  title: string
  body?: string
  primaryCta?: FeaturedSlideCta
  secondaryCta?: FeaturedSlideCta
  tags?: string[]
  /** How long the slide stays before auto-advancing; for video slides set it
   * to the video's duration. */
  autoplayMs?: number
}

const DEFAULT_AUTOPLAY_MS = 5000

const {
  locale = 'en',
  slides,
  class: className
} = defineProps<{
  locale?: Locale
  slides: FeaturedSplitSlide[]
  class?: HTMLAttributes['class']
}>()

const activeIndex = ref(0)
const trackEl = useTemplateRef<HTMLElement>('trackEl')

// The track is a scroll-snap scroller, so swiping is the browser's own
// gesture: taps on the slide controls (play/unmute) and horizontal pans are
// disambiguated natively and never fight each other.
function goTo(index: number): void {
  const count = slides.length
  if (count === 0) return
  const next = (index + count) % count
  activeIndex.value = next
  const el = trackEl.value
  const slide = el?.children.item(next)
  const origin = el?.children.item(0)
  if (el && slide instanceof HTMLElement && origin instanceof HTMLElement) {
    el.scrollTo({
      left: slide.offsetLeft - origin.offsetLeft,
      behavior: reduceMotion.value ? 'auto' : 'smooth'
    })
  }
}

// After a user swipe settles, adopt the nearest snapped slide as active.
// Debounced so the smooth scrolls from goTo (which already set activeIndex)
// don't flick the index — and the mounted VideoPlayer — across every
// intermediate slide they pass.
const syncActiveFromScroll = useDebounceFn(() => {
  const el = trackEl.value
  if (!el) return
  const origin = el.children.item(0)
  if (!(origin instanceof HTMLElement)) return
  let nearest = activeIndex.value
  let bestDistance = Infinity
  for (const [index, child] of Array.from(el.children).entries()) {
    if (!(child instanceof HTMLElement)) continue
    const distance = Math.abs(
      child.offsetLeft - origin.offsetLeft - el.scrollLeft
    )
    if (distance < bestDistance) {
      bestDistance = distance
      nearest = index
    }
  }
  activeIndex.value = nearest
}, 150)

const autoplayDelay = computed(
  () => slides[activeIndex.value]?.autoplayMs ?? DEFAULT_AUTOPLAY_MS
)

// Respect prefers-reduced-motion (WCAG 2.2.2): no auto-advance, and
// programmatic slide changes jump instead of smooth-scrolling; VideoPlayer
// suppresses its own autoplay.
const reduceMotion = computed(() => prefersReducedMotion())

const rootEl = useTemplateRef<HTMLElement>('rootEl')
const isVisible = ref(false)
useIntersectionObserver(rootEl, ([entry]) => {
  isVisible.value = entry?.isIntersecting ?? false
})

// Pause the auto-advance while the user hovers or keyboard-navigates inside
// the carousel (WCAG 2.2.2), so it never moves under the pointer or pulls
// focus into a now-hidden slide. Clicking a control (mute, pause, a dot)
// also focuses it, but that focus lingers after the pointer leaves and would
// stall the carousel indefinitely — so only keyboard-driven focus pauses;
// pointer presence is already covered by hover. Modality comes from the last
// input event, since :focus-visible can't be observed reactively.
const isHovered = useElementHover(rootEl)
const lastInputKeyboard = ref(false)
useEventListener('keydown', () => (lastInputKeyboard.value = true), {
  capture: true,
  passive: true
})
const keyboardFocusWithin = ref(false)
// Any pointer interaction also lifts an active keyboard pause: clicking an
// already-focused control fires no focusin, so the flag would otherwise
// stay stuck. A later keyboard focus re-engages it via focusin.
useEventListener(
  'pointerdown',
  () => {
    lastInputKeyboard.value = false
    keyboardFocusWithin.value = false
  },
  { capture: true, passive: true }
)
useEventListener(rootEl, 'focusin', () => {
  keyboardFocusWithin.value = lastInputKeyboard.value
})
useEventListener(rootEl, 'focusout', (event: FocusEvent) => {
  const next = event.relatedTarget
  if (!(next instanceof Node) || !rootEl.value?.contains(next)) {
    keyboardFocusWithin.value = false
  }
})
const autoplayPaused = computed(
  () => isHovered.value || keyboardFocusWithin.value
)

// Every slide advances on its own timer; video durations arrive as
// `autoplayMs` in the data. Only the active slide mounts a VideoPlayer, so
// audio stops the moment the carousel moves on.
useCarouselAutoplay({
  delayMs: autoplayDelay,
  active: () =>
    !reduceMotion.value &&
    isVisible.value &&
    slides.length > 1 &&
    !autoplayPaused.value,
  resetKey: activeIndex,
  advance: () => goTo(activeIndex.value + 1)
})
</script>

<template>
  <section :class="cn('w-full px-6 lg:px-12', className)">
    <div ref="rootEl" class="max-w-9xl mx-auto">
      <div
        ref="trackEl"
        class="flex snap-x snap-mandatory scrollbar-none gap-4 overflow-x-auto overscroll-x-contain"
        @scroll.passive="syncActiveFromScroll"
      >
        <article
          v-for="(slide, index) in slides"
          :key="slide.id"
          class="bg-transparency-white-t4 lg:rounded-5xl flex w-full shrink-0 snap-center flex-col gap-4 rounded-4xl p-2 lg:flex-row lg:gap-8"
          :aria-hidden="index !== activeIndex"
          :inert="index !== activeIndex"
        >
          <!-- lg:min-w-0 stops aspect-video's transferred min-width from
                 blowing the row out horizontally when the content column is
                 taller than the media's natural 16:9 height. -->
          <div class="relative aspect-video w-full lg:min-w-0 lg:flex-1">
            <VideoPlayer
              v-if="slide.media.type === 'video' && index === activeIndex"
              :locale
              :src="slide.media.src"
              :poster="slide.media.poster"
              :aria-label="slide.media.alt"
              autoplay
              mute-only
              class="lg:rounded-4.5xl absolute inset-0 aspect-auto h-full rounded-3xl border-0"
            />
            <img
              v-else-if="
                slide.media.type === 'image'
                  ? slide.media.src
                  : slide.media.poster
              "
              :src="
                slide.media.type === 'image'
                  ? slide.media.src
                  : slide.media.poster
              "
              :alt="slide.media.alt"
              :loading="index === 0 ? 'eager' : 'lazy'"
              decoding="async"
              class="lg:rounded-4.5xl absolute inset-0 size-full rounded-3xl object-cover object-center"
            />
            <div
              v-else
              class="lg:rounded-4.5xl absolute inset-0 rounded-3xl bg-black"
            />
          </div>

          <div
            class="flex w-full flex-col justify-center p-4 lg:min-w-0 lg:flex-1 lg:p-6"
          >
            <p
              v-if="slide.eyebrow"
              class="text-primary-comfy-yellow text-sm font-bold tracking-[0.7px] uppercase"
            >
              {{ slide.eyebrow }}
            </p>
            <h2
              class="mt-7 max-w-200 text-3xl leading-[135%] font-medium text-primary-comfy-canvas"
            >
              {{ slide.title }}
            </h2>
            <p
              v-if="slide.body"
              class="mt-5 max-w-160 text-[17px] leading-[160%] font-light text-primary-comfy-canvas"
            >
              {{ slide.body }}
            </p>

            <div
              v-if="slide.primaryCta || slide.secondaryCta"
              class="mt-10 flex flex-col items-start gap-3 sm:flex-row lg:flex-col lg:gap-4 xl:mt-16 xl:flex-row"
            >
              <Button
                v-if="slide.primaryCta"
                :href="slide.primaryCta.href"
                :target="slide.primaryCta.newTab ? '_blank' : undefined"
                :rel="
                  resolveRel({
                    target: slide.primaryCta.newTab ? '_blank' : undefined
                  })
                "
              >
                {{ slide.primaryCta.label }}
              </Button>
              <Button
                v-if="slide.secondaryCta"
                variant="outline"
                :href="slide.secondaryCta.href"
                :target="slide.secondaryCta.newTab ? '_blank' : undefined"
                :rel="
                  resolveRel({
                    target: slide.secondaryCta.newTab ? '_blank' : undefined
                  })
                "
              >
                {{ slide.secondaryCta.label }}
              </Button>
            </div>

            <div
              v-if="slide.tags?.length"
              class="mt-10 flex flex-wrap gap-2 xl:mt-14"
            >
              <Badge
                v-for="tag in slide.tags"
                :key="tag"
                variant="subtle"
                size="md"
                class="py-2 text-primary-comfy-canvas"
              >
                {{ tag }}
              </Badge>
            </div>
          </div>
        </article>
      </div>

      <div
        v-if="slides.length > 1"
        class="mt-6 flex items-center justify-center gap-6"
      >
        <button
          v-for="(slide, index) in slides"
          :key="slide.id"
          type="button"
          class="size-3 rounded-full transition-all duration-300"
          :class="
            index === activeIndex
              ? 'scale-125 bg-primary-warm-white'
              : 'bg-primary-warm-gray/60 hover:bg-primary-warm-gray'
          "
          :aria-label="slide.title"
          :aria-current="index === activeIndex ? 'true' : undefined"
          @click="goTo(index)"
        />
      </div>
    </div>
  </section>
</template>
