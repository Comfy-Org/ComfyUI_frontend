<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronRight } from '@lucide/vue'
import { useMediaQuery, useMounted } from '@vueuse/core'
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { ModelLaunchHero } from './types'

import VideoPlayer from '../../components/common/VideoPlayer.vue'
import Badge from '../../components/ui/badge/Badge.vue'
import { t } from '../../i18n/translations'
import ModelLaunchHeroCtaButtons from './ModelLaunchHeroCtaButtons.vue'

const { locale = 'en', hero } = defineProps<{
  hero: ModelLaunchHero
  locale?: Locale
}>()

// SSR (and the first client tick, before onMounted) has no reliable viewport
// to check, so it renders as if mobile: no <video> tag reaches the page at
// all, meaning phones never start fetching hero.videoSrc. Only once mounted
// on a >=768px viewport does the full video swap in; below that, phones play
// hero.mobileVideoSrc when the page ships one, or keep the still when not.
const isMounted = useMounted()
const isDesktopViewport = useMediaQuery('(min-width: 768px)')
const hasMobileMedia = Boolean(
  hero.mobileVideoSrc || hero.mobileFallbackImageSrc
)
const showVideo = computed(
  () => !hasMobileMedia || (isMounted.value && isDesktopViewport.value)
)
const showMobileVideo = computed(
  () =>
    Boolean(hero.mobileVideoSrc) && isMounted.value && !isDesktopViewport.value
)

// 'overlay' is the announcement treatment: media, scrim and content stacked in
// one grid cell. The launch layouts instead reorder the same three blocks.
const isOverlay = hero.layout === 'overlay'
const OVERLAY_CELL = 'col-start-1 row-start-1'
const isContentFirst = hero.layout === 'content-first'
</script>

<template>
  <section
    v-if="isOverlay"
    class="max-w-9xl mx-auto px-6 py-12 lg:px-20 lg:py-16"
  >
    <div class="rounded-4.5xl grid overflow-hidden">
      <img
        v-if="!hero.videoSrc && hero.placeholderImageSrc"
        :src="hero.placeholderImageSrc"
        alt=""
        aria-hidden="true"
        width="1440"
        height="810"
        :class="cn('w-full object-cover', OVERLAY_CELL, 'size-full')"
      />

      <div v-if="hero.videoSrc" :class="cn('relative', OVERLAY_CELL)">
        <VideoPlayer
          v-if="showVideo"
          :locale
          :src="hero.videoSrc"
          autoplay
          loop
        />
        <VideoPlayer
          v-else-if="showMobileVideo"
          :locale
          :src="hero.mobileVideoSrc"
          autoplay
          loop
        />
        <img
          v-else-if="hero.mobileFallbackImageSrc"
          :src="hero.mobileFallbackImageSrc"
          alt=""
          aria-hidden="true"
          width="1280"
          height="720"
          class="aspect-video w-full rounded-4xl border border-white/10 object-cover"
        />
      </div>

      <div
        aria-hidden="true"
        :class="cn(OVERLAY_CELL, 'bg-primary-comfy-ink/50')"
      />

      <div
        :class="
          cn(
            'flex flex-col items-center text-center',
            OVERLAY_CELL,
            'min-h-96 justify-center px-6 py-12 lg:aspect-21/9'
          )
        "
      >
        <p
          v-if="hero.eyebrowKey"
          class="mb-4 text-lg font-medium text-primary-warm-white uppercase lg:text-3xl"
        >
          {{ t(hero.eyebrowKey, locale) }}
        </p>

        <h1
          class="text-4xl font-light tracking-tight text-primary-warm-white sm:text-6xl lg:text-8xl/none"
        >
          {{ t(hero.titleKey, locale)
          }}<span v-if="hero.titleRestKey" class="text-primary-warm-white/80">{{
            t(hero.titleRestKey, locale)
          }}</span>
        </h1>

        <p
          v-if="hero.descriptionKey"
          class="mt-6 max-w-2xl text-base/relaxed font-light text-primary-warm-white lg:text-lg/relaxed"
        >
          {{ t(hero.descriptionKey, locale) }}
        </p>

        <ModelLaunchHeroCtaButtons
          :primary-cta="hero.primaryCta"
          primary-variant="outline-light"
          :secondary-cta="hero.secondaryCta"
          :locale
        />

        <div
          v-if="hero.badgeKeys?.length"
          class="mt-6 flex flex-wrap items-center justify-center gap-3"
        >
          <Badge
            v-for="badgeKey in hero.badgeKeys"
            :key="badgeKey"
            data-testid="model-launch-hero-badge"
            variant="subtle"
          >
            {{ t(badgeKey, locale) }}
          </Badge>
        </div>
      </div>
    </div>
  </section>

  <section
    v-else
    class="max-w-9xl mx-auto flex flex-col px-6 py-12 lg:px-20 lg:py-16"
  >
    <div
      v-if="hero.videoSrc"
      :class="cn('relative', isContentFirst ? 'order-3' : 'order-1')"
    >
      <VideoPlayer
        v-if="showVideo"
        :locale
        :src="hero.videoSrc"
        :poster="hero.posterSrc"
        autoplay
        loop
      />
      <VideoPlayer
        v-else-if="showMobileVideo"
        :locale
        :src="hero.mobileVideoSrc"
        :poster="hero.posterSrc"
        autoplay
        loop
      />
      <img
        v-else-if="hero.mobileFallbackImageSrc"
        :src="hero.mobileFallbackImageSrc"
        alt=""
        aria-hidden="true"
        width="1280"
        height="720"
        class="aspect-video w-full rounded-4xl border border-white/10 object-cover"
      />
      <div
        v-if="hero.logoSrc"
        aria-hidden="true"
        class="bg-transparency-white-t4 pointer-events-none absolute top-6 right-6 flex size-12 items-center justify-center rounded-2xl backdrop-blur-sm lg:top-10 lg:right-10 lg:size-17.5 lg:rounded-3xl"
      >
        <span
          class="inline-block size-6 bg-current text-primary-warm-white lg:size-8.75"
          :style="{
            maskImage: `url(${hero.logoSrc})`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center'
          }"
        />
      </div>
    </div>

    <div
      :class="
        cn(
          'mx-auto flex w-full max-w-2xl flex-col items-center text-center',
          isContentFirst ? 'order-1 mb-10' : 'order-2 mt-10'
        )
      "
    >
      <h1
        class="text-4xl font-light tracking-tight text-primary-comfy-canvas lg:text-6xl/tight"
      >
        {{ t(hero.titleKey, locale)
        }}<span v-if="hero.titleRestKey" class="text-primary-comfy-canvas/80">{{
          t(hero.titleRestKey, locale)
        }}</span>
      </h1>

      <p
        v-if="hero.descriptionKey"
        class="mt-6 text-base/relaxed font-light text-primary-comfy-canvas lg:text-lg/relaxed"
      >
        {{ t(hero.descriptionKey, locale) }}
      </p>

      <ModelLaunchHeroCtaButtons
        :primary-cta="hero.primaryCta"
        primary-variant="solid"
        :secondary-cta="hero.secondaryCta"
        :locale
      />

      <div
        v-if="hero.badgeKeys?.length"
        class="mt-6 flex flex-wrap items-center justify-center gap-3"
      >
        <Badge
          v-for="badgeKey in hero.badgeKeys"
          :key="badgeKey"
          data-testid="model-launch-hero-badge"
          variant="subtle"
        >
          {{ t(badgeKey, locale) }}
        </Badge>
      </div>
    </div>

    <a
      v-if="hero.promptBar"
      :href="hero.promptBar.cta.href"
      :target="hero.promptBar.cta.target"
      rel="noopener"
      :class="
        cn(
          'bg-transparency-white-t4 hover:border-primary-comfy-yellow/40 hidden w-full flex-col items-start gap-4 rounded-4xl border border-white/10 p-6 text-left transition-colors sm:flex-row sm:items-center sm:justify-between lg:flex lg:px-10 lg:py-7',
          isContentFirst ? 'order-2 mb-10' : 'order-3 mt-10'
        )
      "
    >
      <span class="text-sm text-primary-warm-gray lg:text-base">
        {{ t(hero.promptBar.sampleKey, locale) }}
      </span>
      <span
        class="text-primary-comfy-yellow flex shrink-0 items-center gap-3 text-sm font-extrabold tracking-wider uppercase"
      >
        <span
          class="bg-primary-comfy-yellow flex size-8 items-center justify-center rounded-full text-primary-comfy-ink"
        >
          <ChevronRight class="size-5" :stroke-width="2" />
        </span>
        {{ t(hero.promptBar.cta.labelKey, locale) }}
      </span>
    </a>
  </section>
</template>
