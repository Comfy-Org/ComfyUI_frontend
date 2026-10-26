<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useSlideRotation } from '@/composables/useSlideRotation'
import { usePreviewVideo } from '@/composables/usePreviewVideo'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

import Button from '@/components/ui/button/Button.vue'
import FeaturedBannerPagination from './FeaturedBannerPagination.vue'

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

const {
  slides,
  locale = 'en',
  autoplay = true
} = defineProps<{
  slides: readonly FeaturedSlide[]
  locale?: Locale
  autoplay?: boolean
}>()
const { t } = translationsFor(locale)
const emit = defineEmits<{ open: [slide: FeaturedSlide, position: number] }>()

const banner = useTemplateRef<HTMLElement>('banner')
const { activeIndex, shownIndex, goTo, fill, onScreen } = useSlideRotation({
  root: banner,
  count: () => slides.length,
  intervalMs: AUTOPLAY_MS,
  autoplay: () => autoplay
})
const active = computed<FeaturedSlide | undefined>(
  () => slides[shownIndex.value]
)

const video = useTemplateRef<HTMLVideoElement>('video')
const previewSrc = usePreviewVideo(video, () => active.value?.media?.url, {
  visible: () => onScreen.value
})
</script>

<template>
  <section
    v-if="active"
    ref="banner"
    :aria-label="t('workshop.sections.featured')"
    class="relative isolate overflow-hidden rounded-3xl border border-transparency-white-t8"
    data-testid="section-featured"
  >
    <div
      class="group relative flex min-h-52 sm:min-h-44"
      data-testid="featured-slide"
    >
      <a
        :href="active.href"
        tabindex="-1"
        aria-hidden="true"
        class="absolute inset-0"
        data-testid="featured-slide-link"
        @click="emit('open', active, shownIndex)"
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
        fetchpriority="high"
      />
      <div
        class="pointer-events-none absolute inset-0 bg-linear-to-t from-page/90 via-page/80 to-page/20 sm:bg-linear-to-r sm:via-page/75 sm:to-transparent"
        aria-hidden="true"
      />

      <div
        class="pointer-events-none relative flex w-full min-w-0 flex-col justify-end gap-5 px-7 pt-7 pb-17 max-sm:px-5 max-sm:pt-5 lg:px-9 lg:pt-8"
      >
        <h2
          class="line-clamp-2 max-w-3xl text-xl font-bold text-balance text-primary-warm-white lg:text-2xl"
        >
          {{ active.title }}
        </h2>

        <div class="pointer-events-auto flex w-fit items-center gap-3">
          <Button
            as="a"
            variant="secondary"
            :href="active.href"
            class="w-fit"
            @click="emit('open', active, shownIndex)"
          >
            {{ active.cta ?? t('workshop.hub.tryNow') }}
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
            {{ t('workshop.hub.docs') }}
          </Button>
        </div>
      </div>
    </div>

    <FeaturedBannerPagination
      v-if="slides.length > 1"
      :slides
      :active-index="activeIndex"
      :fill
      @go="goTo"
    />
  </section>
</template>
