<template>
  <div
    ref="rootEl"
    class="flex size-full min-h-0 flex-col items-center justify-center px-6 py-8 xl:p-10 2xl:px-14"
  >
    <div
      role="group"
      :aria-roledescription="t('cloudHero.carouselRoleDescription')"
      :aria-label="t('cloudHero.carouselLabel')"
      class="flex min-h-0 w-auto max-w-3xl flex-1 flex-col justify-center gap-4 xl:gap-5 2xl:gap-6"
    >
      <p class="sr-only" role="status" aria-live="polite">
        {{ announcement }}
      </p>
      <div
        class="relative aspect-769/889 max-h-full min-h-0 w-auto max-w-full shrink overflow-clip rounded-[2.5rem] bg-primary-comfy-canvas/4"
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
            :aria-roledescription="t('cloudHero.slideRoleDescription')"
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
                <i
                  :class="cn(PROVIDER_ICON[slide.provider], 'size-6 xl:size-8')"
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
        <Button
          type="button"
          variant="brand-ghost-accent"
          size="brand-icon"
          class="shrink-0"
          :aria-label="t('cloudHero.previousSlide')"
          @click="goToPrevious"
        >
          <i class="icon-[lucide--chevron-left] size-6" />
        </Button>
        <Button
          type="button"
          variant="brand-ghost-accent"
          size="brand-icon"
          class="shrink-0"
          :aria-label="t('cloudHero.nextSlide')"
          @click="goToNext"
        >
          <i class="icon-[lucide--chevron-right] size-6" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'

import { useProgressBarPainter } from '@/platform/cloud/onboarding/composables/useProgressBarPainter'
import { useVideoCarousel } from '@/platform/cloud/onboarding/composables/useVideoCarousel'
import {
  HERO_SLIDES,
  PROVIDER_ICON
} from '@/platform/cloud/onboarding/constants/heroSlides'
import { wrapIndex } from '@/utils/mathUtil'

import '../assets/css/heroVideo.css'

const { t } = useI18n()

const rootEl = useTemplateRef<HTMLElement>('rootEl')
const progressFillEl = useTemplateRef<HTMLElement>('progressFillEl')
const trackEl = useTemplateRef<HTMLElement>('trackEl')

/** Slots of run-up kept before the active slide, so a backwards step has
 *  somewhere to come from. One is enough: only ever one slide is in flight. */
const SLIDE_LEAD = 1

/** Flushes pending style writes so the next one animates from them. */
const forceReflow = (el: HTMLElement) => void el.offsetWidth

const slides = HERO_SLIDES

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
  announcement.value = t('cloudHero.slideStatus', {
    title: slide.title,
    current: activeIndex.value + 1,
    total: slides.length
  })
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
 * frame, which turns every move -- including the wrap -- into the same
 * one-slide glide in the direction the user asked for.
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
</script>
