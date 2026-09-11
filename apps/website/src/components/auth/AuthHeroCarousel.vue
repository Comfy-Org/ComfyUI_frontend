<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { breakpointsTailwind, useBreakpoints, useMounted } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { HERO_SLIDES, PROVIDER_ICON } from '../../config/hero-slides'
import { useProgressBarPainter } from '../../composables/useProgressBarPainter'
import { useVideoCarousel, wrapIndex } from '../../composables/useVideoCarousel'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

/**
 * Mirrors the cloud shell: below `xl` the reel is never mounted, so no video
 * downloads. Waiting for mount keeps the server and first client render in
 * agreement; the SSR'd column wrapper already holds the layout.
 */
const mounted = useMounted()
const isWideViewport = useBreakpoints(breakpointsTailwind).greaterOrEqual('xl')
const showHero = computed(() => mounted.value && isWideViewport.value)

const rootEl = useTemplateRef<HTMLElement>('rootEl')
const progressFillEl = useTemplateRef<HTMLElement>('progressFillEl')
const trackEl = useTemplateRef<HTMLElement>('trackEl')

/** Slots of run-up kept before the active slide, so a backwards step has
 *  somewhere to come from. One is enough: only ever one slide is in flight. */
const SLIDE_LEAD = 1

/** Flushes pending style writes so the next one animates from them. */
const forceReflow = (el: HTMLElement) => void el.offsetWidth

const slides = HERO_SLIDES

const NAV_BUTTON_CLASS =
  'relative inline-flex size-10 shrink-0 cursor-pointer touch-manipulation appearance-none items-center justify-center gap-2 rounded-2xl border-none bg-transparency-white-t8 font-inter text-sm font-medium whitespace-nowrap text-primary-warm-white transition-colors hover:bg-brand-yellow hover:text-primary-comfy-ink focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 xl:size-12 [&_svg]:pointer-events-none [&_svg]:shrink-0'

const {
  activeIndex,
  lastStep,
  setVideoRef,
  isCarouselActive,
  next,
  previous,
  onPlaying,
  onProgress,
  onStalled,
  onEnded,
  onError,
  preloadFor,
  progress
} = useVideoCarousel({ count: slides.length, root: rootEl })

useProgressBarPainter({
  target: progressFillEl,
  progress,
  active: isCarouselActive
})

const announcement = ref('')

const announceCurrentSlide = () => {
  const slide = slides[activeIndex.value]
  if (!slide) return
  announcement.value = t('auth.hero.slideStatus', locale)
    .replace('{title}', slide.title)
    .replace('{current}', String(activeIndex.value + 1))
    .replace('{total}', String(slides.length))
}

const goToNext = () => {
  next()
  announceCurrentSlide()
}

const goToPrevious = () => {
  previous()
  announceCurrentSlide()
}

/**
 * Rotates the flex order so the active slide always sits at the same slot, with
 * a neighbour either side. Keeping every slide in flow matters: the frame is
 * `w-auto` with a fixed aspect ratio, so it derives its width from the height of
 * its in-flow children and collapses if they are taken out.
 */
const slideOrder = (index: number) =>
  wrapIndex(index - activeIndex.value + SLIDE_LEAD, slides.length)

const RESTING_X = -SLIDE_LEAD * 100

/**
 * `order` applies instantly, so animating it directly would teleport. Instead
 * the strip is nudged one slot opposite the travel and released on the next
 * frame, which turns every move, including the wrap, into the same one-slide
 * glide in the direction the user asked for.
 */
watch(activeIndex, (to, from) => {
  const track = trackEl.value
  if (!track || to === from) return

  const offscreenX = RESTING_X + lastStep.value * 100

  const slideFrom = (x: number) => {
    track.style.transition = 'none'
    track.style.transform = `translateX(${x}%)`
  }
  const releaseTo = (x: number) => {
    track.style.transition = ''
    track.style.transform = `translateX(${x}%)`
  }

  slideFrom(offscreenX)
  forceReflow(track)
  releaseTo(RESTING_X)
})

const providerMask = (provider: keyof typeof PROVIDER_ICON) => ({
  maskImage: `url("${PROVIDER_ICON[provider]}")`,
  maskRepeat: 'no-repeat',
  maskSize: '100% 100%'
})
</script>

<template>
  <div
    v-if="showHero"
    ref="rootEl"
    class="flex size-full min-h-0 flex-col items-center justify-center px-6 py-8 xl:p-10 2xl:px-14"
  >
    <div
      role="group"
      :aria-roledescription="t('auth.hero.carouselRoleDescription', locale)"
      :aria-label="t('auth.hero.carouselLabel', locale)"
      class="flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 xl:gap-5 2xl:gap-6"
    >
      <p class="sr-only" role="status" aria-live="polite">
        {{ announcement }}
      </p>
      <div
        class="relative min-h-0 w-full flex-1 overflow-clip rounded-[2.5rem] bg-primary-comfy-canvas/4"
      >
        <div
          ref="trackEl"
          class="flex size-full motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out"
          :style="{ transform: `translateX(-${SLIDE_LEAD * 100}%)` }"
        >
          <div
            v-for="(slide, index) in slides"
            :key="slide.id"
            role="group"
            :aria-roledescription="t('auth.hero.slideRoleDescription', locale)"
            :aria-label="slide.title"
            :aria-hidden="index !== activeIndex"
            :inert="index !== activeIndex"
            class="relative size-full shrink-0"
            :style="{ order: slideOrder(index) }"
          >
            <video
              :ref="(el) => setVideoRef(index, el)"
              :poster="slide.poster"
              :preload="preloadFor(index)"
              :loop="slides.length === 1"
              muted
              playsinline
              disablepictureinpicture
              disableremoteplayback
              aria-hidden="true"
              class="cloud-hero-video size-full object-cover object-center"
              @playing="onPlaying(index)"
              @timeupdate="onProgress(index)"
              @waiting="onStalled(index)"
              @pause="onStalled(index)"
              @ended="onEnded(index)"
              @error="onError(index)"
            >
              <source :src="slide.src" :type="slide.mimeType" />
            </video>

            <div
              aria-hidden="true"
              class="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/70 to-transparent"
            />

            <div
              class="absolute inset-x-0 bottom-0 flex items-center gap-4 p-5 xl:p-6 2xl:p-8"
            >
              <span
                class="flex size-12 shrink-0 items-center justify-center rounded-3xl bg-transparency-white-t8 backdrop-blur-[6px] xl:size-16"
              >
                <span
                  aria-hidden="true"
                  class="size-6 bg-current xl:size-8"
                  :style="providerMask(slide.provider)"
                />
              </span>
              <p
                class="m-0 text-2xl/tight font-medium tracking-tight text-primary-warm-white xl:text-3xl/tight 2xl:text-4xl/tight"
              >
                {{ slide.title }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="slides.length > 1"
        class="flex w-full shrink-0 items-center gap-4 xl:gap-6"
      >
        <div
          class="h-2 min-w-0 flex-1 overflow-clip rounded-full bg-transparency-white-t20 backdrop-blur-[30px]"
        >
          <div
            ref="progressFillEl"
            class="size-full origin-left scale-x-0 bg-brand-yellow shadow-[0_0_8px_-1px_white] will-change-transform"
          />
        </div>
        <button
          type="button"
          :class="NAV_BUTTON_CLASS"
          :aria-label="t('auth.hero.previousSlide', locale)"
          @click="goToPrevious"
        >
          <ChevronLeft class="size-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          :class="NAV_BUTTON_CLASS"
          :aria-label="t('auth.hero.nextSlide', locale)"
          @click="goToNext"
        >
          <ChevronRight class="size-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>
