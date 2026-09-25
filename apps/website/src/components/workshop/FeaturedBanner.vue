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
import Badge from '../ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'

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
}

const AUTOPLAY_MS = 7000

const {
  slides,
  locale = 'en',
  autoplay = true
} = defineProps<{
  slides: readonly FeaturedSlide[]
  locale?: Locale
  autoplay?: boolean
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

const fill = computed(() =>
  !autoplay || prefersReducedMotion()
    ? 1
    : Math.min(elapsed.value / AUTOPLAY_MS, 1)
)
</script>

<template>
  <section
    v-if="active"
    ref="banner"
    :aria-label="t('workshop.sections.featured', locale)"
    class="relative isolate overflow-hidden rounded-4.5xl border border-transparency-white-t8"
    data-testid="section-featured"
  >
    <div
      class="group relative block h-84 short:h-57 sm:short:h-60"
      data-testid="featured-slide"
    >
      <a
        :href="active.href"
        tabindex="-1"
        aria-hidden="true"
        class="absolute inset-0"
        data-testid="featured-slide-link"
      ></a>
      <video
        v-if="active.media?.kind === 'video'"
        :key="active.key"
        ref="video"
        :src="previewSrc"
        class="pointer-events-none absolute inset-0 size-full object-cover"
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
        class="pointer-events-none absolute inset-0 size-full object-cover"
        decoding="async"
      />
      <div
        class="pointer-events-none absolute inset-0 bg-linear-to-t from-page/90 via-page/80 to-page/20 sm:bg-linear-to-r sm:via-page/75 sm:to-transparent"
        aria-hidden="true"
      />

      <div
        class="pointer-events-none relative flex h-full flex-col justify-end gap-4 p-8 pt-6 pb-16 max-sm:gap-3 max-sm:p-6 max-sm:pb-14 sm:max-w-2xl sm:justify-center lg:p-12 lg:pt-8 lg:pb-18 short:gap-3 short:pt-5 short:pb-14"
      >
        <div class="flex flex-wrap items-center gap-2">
          <Badge
            variant="subtle"
            size="md"
            class="text-primary-comfy-canvas backdrop-blur-md"
          >
            {{ active.kind }}
          </Badge>
          <Badge
            v-for="capability in active.tags"
            :key="capability"
            variant="subtle"
            size="md"
            class="text-content-secondary backdrop-blur-md max-sm:hidden"
          >
            {{ capability }}
          </Badge>
        </div>

        <h2
          class="text-2xl font-bold text-balance text-primary-warm-white lg:text-3xl"
        >
          {{ active.title }}
        </h2>

        <p
          v-if="active.summary"
          class="line-clamp-2 max-w-prose shrink-0 text-content-secondary max-sm:line-clamp-1 short:hidden"
        >
          {{ active.summary }}
        </p>

        <div class="pointer-events-auto flex w-fit items-center gap-3">
          <Button as="a" :href="active.href" class="w-fit">
            {{ t('workshop.hub.tryNow', locale) }}
          </Button>
          <Button
            v-if="active.docsHref"
            as="a"
            variant="outline"
            :href="active.docsHref"
            target="_blank"
            rel="noopener noreferrer"
            class="w-fit"
            data-testid="featured-docs-link"
          >
            {{ t('workshop.hub.docs', locale) }}
          </Button>
        </div>
      </div>
    </div>

    <div
      v-if="slides.length > 1"
      class="pointer-events-none absolute inset-x-8 bottom-5 flex gap-2 lg:inset-x-12"
      data-testid="featured-pagination"
    >
      <button
        v-for="(slide, index) in slides"
        :key="slide.key"
        type="button"
        :aria-label="slide.title"
        :aria-current="index === activeIndex ? 'true' : undefined"
        class="group pointer-events-auto max-w-12 min-w-0 flex-1 cursor-pointer rounded-full py-3 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        @click="goTo(index)"
      >
        <span
          class="block h-1 overflow-hidden rounded-full bg-transparency-white-t20 group-hover:bg-primary-warm-gray"
        >
          <span
            class="block h-full rounded-full bg-primary-warm-white"
            :style="{
              width: index === activeIndex ? `${fill * 100}%` : '0%'
            }"
          />
        </span>
      </button>
    </div>
  </section>
</template>
