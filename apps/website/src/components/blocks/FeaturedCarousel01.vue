<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import {
  useElementHover,
  useFocusWithin,
  useIntersectionObserver
} from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import IconButton from '../ui/icon-button/IconButton.vue'
import { useCarouselAutoplay } from '../../composables/useCarouselAutoplay'
import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { resolveRel } from '../../utils/cta'

type FeaturedSlideMedia = {
  type: 'image' | 'video'
  src: string
  alt: string
  poster?: string
}

export type FeaturedSlide = {
  id: string
  media: FeaturedSlideMedia
  eyebrow?: string
  title?: string
  showTitle?: boolean
  href?: string
  newTab?: boolean
  autoplayMs?: number
}

const DEFAULT_AUTOPLAY_MS = 6000

const { slides, prevLabel, nextLabel } = defineProps<{
  slides: FeaturedSlide[]
  prevLabel: string
  nextLabel: string
}>()

const activeIndex = ref(0)

function goTo(index: number): void {
  const count = slides.length
  activeIndex.value = (index + count) % count
}

const autoplayDelay = computed(
  () => slides[activeIndex.value]?.autoplayMs ?? DEFAULT_AUTOPLAY_MS
)

// Respect prefers-reduced-motion (WCAG 2.2.2): the video never plays and the
// carousel does not auto-advance; the paused video shows its poster frame.
const reduceMotion = computed(() => prefersReducedMotion())

const rootEl = useTemplateRef<HTMLElement>('rootEl')
const isVisible = ref(false)
useIntersectionObserver(rootEl, ([entry]) => {
  isVisible.value = entry?.isIntersecting ?? false
})

// Pause the carousel's auto-advance while the user hovers or has keyboard focus
// inside it (WCAG 2.2.2). The video keeps playing but the carousel stays put, so
// autoplay never moves it or pulls focus into a now-hidden slide.
const isHovered = useElementHover(rootEl)
const { focused: isFocusWithin } = useFocusWithin(rootEl)
const autoplayPaused = computed(() => isHovered.value || isFocusWithin.value)

// Slides are mixed image/video, so keep video elements keyed by slide index
// rather than a DOM-order refs list.
const videoEls = ref<(HTMLVideoElement | null)[]>([])
const setVideoRef = (index: number, el: unknown) => {
  videoEls.value[index] = el instanceof HTMLVideoElement ? el : null
}
const activeVideo = computed(() => videoEls.value[activeIndex.value] ?? null)
const activeIsVideo = computed(
  () => slides[activeIndex.value]?.media.type === 'video'
)

// Restart the video only when the slide actually changes, not when the carousel
// scrolls in and out of the viewport.
watch(activeIndex, () => {
  const el = activeVideo.value
  if (el) el.currentTime = 0
})

// Play the active slide's video while the carousel is on screen and motion is
// allowed; every other video stays paused.
watch(
  [isVisible, reduceMotion, activeVideo],
  () => {
    videoEls.value.forEach((el, index) => {
      if (el && index !== activeIndex.value) el.pause()
    })
    const el = activeVideo.value
    if (!el) return
    if (isVisible.value && !reduceMotion.value) {
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  },
  { immediate: true }
)

// A finished video advances to the next slide, unless the carousel is paused
// (hover/focus) — then it stays put. Switching slides restarts the video.
const onVideoEnded = (index: number) => {
  if (index !== activeIndex.value || autoplayPaused.value) return
  goTo(activeIndex.value + 1)
}

// A broken video is skipped even while paused; retrying it would loop the error.
const onVideoError = (index: number) => {
  if (index === activeIndex.value) goTo(activeIndex.value + 1)
}

// Image slides advance on a timer; video slides advance when their video ends.
useCarouselAutoplay({
  delayMs: autoplayDelay,
  active: () =>
    !reduceMotion.value &&
    isVisible.value &&
    slides.length > 1 &&
    !activeIsVideo.value &&
    !autoplayPaused.value,
  resetKey: activeIndex,
  advance: () => goTo(activeIndex.value + 1)
})
</script>

<template>
  <div class="w-full px-6 lg:px-14">
    <div
      ref="rootEl"
      class="border-primary-warm-gray relative mx-auto max-w-[1446px] rounded-[38px] border p-1.5 lg:p-5"
    >
      <div class="relative overflow-clip rounded-4xl lg:rounded-[38px]">
        <div
          class="flex"
          :class="
            prefersReducedMotion()
              ? undefined
              : 'transition-transform duration-500 ease-out'
          "
          :style="{ transform: `translateX(-${activeIndex * 100}%)` }"
        >
          <div
            v-for="(slide, index) in slides"
            :key="slide.id"
            class="relative aspect-video w-full shrink-0 md:aspect-1406/622"
            :aria-hidden="index !== activeIndex"
          >
            <img
              v-if="slide.media.type === 'image'"
              :src="slide.media.src"
              :alt="slide.media.alt"
              :loading="index === 0 ? 'eager' : 'lazy'"
              decoding="async"
              class="absolute inset-0 size-full object-cover object-center"
            />
            <video
              v-else
              :ref="(el) => setVideoRef(index, el)"
              :src="slide.media.src"
              :poster="slide.media.poster"
              :aria-label="slide.media.alt"
              :loop="slides.length === 1"
              muted
              playsinline
              preload="metadata"
              class="absolute inset-0 size-full object-cover object-center"
              @ended="onVideoEnded(index)"
              @error="onVideoError(index)"
            />
            <div class="absolute inset-0 bg-black/20" />

            <div
              v-if="slide.showTitle !== false && (slide.eyebrow || slide.title)"
              aria-hidden="true"
              class="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/80 via-black/40 to-transparent"
            />

            <div
              v-if="slide.eyebrow || slide.title"
              :class="
                slide.showTitle !== false
                  ? 'absolute inset-x-6 bottom-6 flex flex-col gap-3 lg:right-56 lg:bottom-14 lg:left-[72px]'
                  : 'sr-only'
              "
            >
              <p
                v-if="slide.eyebrow"
                class="text-primary-comfy-yellow text-xs font-semibold tracking-wide uppercase"
              >
                {{ slide.eyebrow }}
              </p>
              <p
                v-if="slide.title"
                class="text-2xl font-light tracking-tight text-balance text-primary-comfy-canvas md:text-3xl lg:text-5xl/tight"
              >
                {{ slide.title }}
              </p>
            </div>

            <a
              v-if="slide.href"
              :href="slide.href"
              :target="slide.newTab ? '_blank' : undefined"
              :rel="resolveRel({ target: slide.newTab ? '_blank' : undefined })"
              :aria-label="slide.title ?? slide.media.alt"
              :tabindex="index === activeIndex ? undefined : -1"
              class="focus-visible:ring-primary-comfy-yellow absolute inset-0 focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>
        </div>

        <div
          v-if="slides.length > 1"
          class="absolute right-4 bottom-4 flex gap-4 lg:right-10 lg:bottom-10"
        >
          <IconButton
            variant="ghost"
            size="lg"
            class="text-primary-warm-white rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
            :aria-label="prevLabel"
            @click="goTo(activeIndex - 1)"
          >
            <ChevronLeft class="size-7" />
          </IconButton>
          <IconButton
            variant="ghost"
            size="lg"
            class="text-primary-warm-white rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
            :aria-label="nextLabel"
            @click="goTo(activeIndex + 1)"
          >
            <ChevronRight class="size-7" />
          </IconButton>
        </div>
      </div>
    </div>
  </div>
</template>
