<script setup lang="ts">
import {
  useDocumentVisibility,
  useElementHover,
  useElementVisibility,
  useEventListener,
  useRafFn
} from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { usePreviewVideo } from '../../composables/usePreviewVideo'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { cn } from '@comfyorg/tailwind-utils'

import FeaturedBannerPagination from './FeaturedBannerPagination.vue'
import FeaturedCarousel from './FeaturedCarousel.vue'
import FeaturedSlideCopy from './FeaturedSlideCopy.vue'

/**
 * One thing worth opening, whatever kind of thing the catalogue holds. The
 * shape lives here rather than beside the projections that build it, so a
 * catalogue with nothing to do with models can render the banner without
 * pulling the model catalogue in behind it.
 */
export interface FeaturedSlide {
  readonly key: string
  readonly href: string
  readonly title: string
  /** What it is or what it makes, in the badge that leads the slide. */
  readonly kind: string
  readonly tags: readonly string[]
  readonly summary: string | undefined
  readonly media: { url: string; kind: 'image' | 'video' } | undefined
  readonly docsHref: string | undefined
  readonly cta?: string
}

const AUTOPLAY_MS = 7000

/**
 * What the tab is for, in the tab's own words. Given one, the banner keeps the
 * pitch above the row and the slides become pictures under it, the middle one
 * open and its neighbours waiting either side.
 */
interface FeaturedPitch {
  readonly heading: string
  readonly body: string
}

const {
  slides,
  pitch,
  locale = 'en',
  autoplay = true,
  compact = false
} = defineProps<{
  slides: readonly FeaturedSlide[]
  pitch?: FeaturedPitch
  locale?: Locale
  autoplay?: boolean
  /** Where outcome rows follow immediately, the banner gives up height so the
   * first of them is on screen with it. */
  compact?: boolean
}>()

const activeIndex = ref(0)
const active = computed<FeaturedSlide | undefined>(
  () => slides[Math.min(activeIndex.value, slides.length - 1)]
)

function goTo(index: number) {
  activeIndex.value = (index + slides.length) % slides.length
}

const banner = useTemplateRef<HTMLElement>('banner')
const hovered = useElementHover(banner)
// Starts true so the server-rendered first slide carries its video source and
// the browser requests the frame during parse; the observer corrects it once
// hydrated. Rotation does not care: it runs on requestAnimationFrame, which
// only exists in the browser.
const onScreen = useElementVisibility(banner, { initialValue: true })
const visibility = useDocumentVisibility()
const video = useTemplateRef<HTMLVideoElement>('video')
// The video fills the banner, so the banner's observer is its observer.
const previewSrc = usePreviewVideo(video, () => active.value?.media?.url, {
  visible: () => onScreen.value
})

// Clicking a bar leaves it focused, so pausing on any focus would stop the
// rotation for good. Only a keyboard visitor, who needs the time, stops it.
const readingByKeyboard = ref(false)
const trackKeyboardFocus = () => {
  readingByKeyboard.value =
    banner.value?.querySelector(':focus-visible') != null
}
useEventListener(banner, 'focusin', trackKeyboardFocus)
useEventListener(banner, 'focusout', () => (readingByKeyboard.value = false))

const rotating = computed(
  () =>
    autoplay &&
    slides.length > 1 &&
    onScreen.value &&
    visibility.value === 'visible' &&
    !hovered.value &&
    !readingByKeyboard.value &&
    !prefersReducedMotion()
)

// The bar is the timer: it fills over the slide's turn and freezes where it
// stands while the visitor reads, rather than animating on its own clock.
const elapsed = ref(0)
const { pause, resume } = useRafFn(
  ({ delta }) => {
    elapsed.value += delta
    if (elapsed.value >= AUTOPLAY_MS) goTo(activeIndex.value + 1)
  },
  { immediate: false }
)

watch(rotating, (on) => (on ? resume() : pause()), { immediate: true })
watch(activeIndex, () => (elapsed.value = 0))

const frame = computed(() =>
  compact
    ? 'min-h-68 short:min-h-48 sm:short:min-h-50'
    : 'min-h-84 short:min-h-57 sm:short:min-h-60'
)

const fill = computed(() =>
  !autoplay || prefersReducedMotion()
    ? 1
    : Math.min(elapsed.value / AUTOPLAY_MS, 1)
)
</script>

<template>
  <section
    v-if="active || pitch"
    ref="banner"
    :aria-label="t('workshop.sections.featured', locale)"
    :class="
      cn(
        'relative isolate',
        !pitch &&
          'overflow-hidden rounded-4.5xl border border-transparency-white-t8'
      )
    "
    data-testid="section-featured"
  >
    <template v-if="pitch">
      <div class="flex flex-col items-center gap-2 text-center">
        <h1
          class="text-3xl/tight font-light text-balance text-primary-warm-white lg:text-4xl/tight"
          data-testid="catalogue-pitch"
        >
          {{ pitch.heading }}
        </h1>
        <p class="max-w-prose text-content-secondary">{{ pitch.body }}</p>
      </div>

      <div
        v-if="active"
        class="mt-5 flex flex-col items-center gap-3"
        data-testid="featured-slide"
      >
        <FeaturedCarousel
          class="w-full"
          :slides
          :active-index="activeIndex"
          @go="goTo"
        >
          <video
            v-if="active.media?.kind === 'video'"
            :key="active.key"
            ref="video"
            :src="previewSrc"
            class="pointer-events-none size-full object-cover"
            aria-hidden="true"
            muted
            loop
            playsinline
            preload="metadata"
            data-testid="featured-video"
          />
          <img
            v-else-if="active.media"
            :key="active.key"
            :src="active.media.url"
            alt=""
            class="pointer-events-none size-full object-cover"
            decoding="async"
          />
        </FeaturedCarousel>

        <FeaturedBannerPagination
          v-if="slides.length > 1"
          :slides
          :active-index="activeIndex"
          :fill
          aside
          @go="goTo"
        />
      </div>
    </template>

    <template v-else>
      <div
        :class="cn('group relative flex', frame)"
        data-testid="featured-slide"
      >
        <template v-if="active">
          <a
            :href="active.href"
            tabindex="-1"
            aria-hidden="true"
            class="absolute inset-0"
            data-testid="featured-slide-link"
          ></a>
          <div class="pointer-events-none absolute inset-0">
            <video
              v-if="active.media?.kind === 'video'"
              :key="active.key"
              ref="video"
              :src="previewSrc"
              class="absolute inset-0 size-full object-cover"
              aria-hidden="true"
              muted
              loop
              playsinline
              preload="metadata"
              data-testid="featured-video"
            />
            <img
              v-else-if="active.media"
              :key="active.key"
              :src="active.media.url"
              alt=""
              class="absolute inset-0 size-full object-cover"
              decoding="async"
            />
            <div
              class="absolute inset-0 bg-linear-to-t from-page/90 via-page/80 to-page/20 sm:bg-linear-to-r sm:via-page/75 sm:to-transparent"
              aria-hidden="true"
            />
          </div>
        </template>

        <div
          :class="
            cn(
              'pointer-events-none relative flex w-full min-w-0 flex-col justify-end gap-4 p-8 pt-6 pb-16 max-sm:gap-3 max-sm:p-6 max-sm:pb-14 sm:max-w-2xl sm:justify-center lg:p-12 lg:pt-8 lg:pb-18 short:gap-3 short:pt-5 short:pb-14',
              compact &&
                'gap-3 p-7 pt-7 pb-12 max-sm:p-5 max-sm:pb-11 lg:p-9 lg:pt-8 lg:pb-12'
            )
          "
        >
          <FeaturedSlideCopy v-if="active" :slide="active" :locale />
        </div>
      </div>

      <FeaturedBannerPagination
        v-if="slides.length > 1"
        :slides
        :active-index="activeIndex"
        :fill
        @go="goTo"
      />
    </template>
  </section>
</template>
