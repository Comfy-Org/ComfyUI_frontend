<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import type { ModelLaunchHero } from './types'

import BrandButton from '../../components/common/BrandButton.vue'
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import Badge from '../../components/ui/badge/Badge.vue'
import { t } from '../../i18n/translations'

const { locale = 'en', hero } = defineProps<{
  hero: ModelLaunchHero
  locale?: Locale
}>()

// Both layouts render one content block. 'overlay' stacks the media, the scrim
// and that block in a single grid cell instead of letting them flow.
const isOverlay = hero.layout === 'overlay'
const OVERLAY_CELL = 'col-start-1 row-start-1'
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-12 lg:px-20 lg:py-16">
    <div :class="cn(isOverlay && 'rounded-4.5xl grid overflow-hidden')">
      <img
        v-if="!hero.videoSrc && hero.placeholderImageSrc"
        :src="hero.placeholderImageSrc"
        alt=""
        aria-hidden="true"
        width="1440"
        height="810"
        :class="
          cn(
            'w-full object-cover',
            isOverlay
              ? `${OVERLAY_CELL} size-full`
              : 'aspect-21/9 rounded-4xl border border-white/10'
          )
        "
      />

      <div
        v-if="hero.videoSrc"
        :class="cn('relative', isOverlay && OVERLAY_CELL)"
      >
        <VideoPlayer :locale :src="hero.videoSrc" autoplay loop />
        <div
          v-if="hero.logoSrc"
          aria-hidden="true"
          class="bg-transparency-white-t4 pointer-events-none absolute top-6 right-6 flex size-12 items-center justify-center rounded-2xl backdrop-blur-sm lg:top-10 lg:right-10 lg:size-[70px] lg:rounded-3xl"
        >
          <span
            class="inline-block size-6 bg-current text-primary-warm-white lg:size-[35px]"
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
        v-if="isOverlay"
        aria-hidden="true"
        :class="cn(OVERLAY_CELL, 'bg-black/30')"
      />

      <div
        :class="
          cn(
            'flex flex-col items-center text-center',
            isOverlay
              ? `${OVERLAY_CELL} min-h-96 justify-center px-6 py-12 lg:aspect-21/9`
              : 'mx-auto mt-10 max-w-2xl'
          )
        "
      >
        <p
          v-if="hero.eyebrowKey"
          :class="
            cn(
              'mb-4',
              isOverlay
                ? 'text-lg font-medium text-primary-warm-white uppercase lg:text-3xl'
                : 'text-primary-comfy-yellow text-sm font-extrabold tracking-wider uppercase'
            )
          "
        >
          {{ t(hero.eyebrowKey, locale) }}
        </p>

        <h1
          :class="
            cn(
              'font-light tracking-tight',
              isOverlay
                ? 'text-4xl text-primary-warm-white sm:text-6xl lg:text-8xl/none'
                : 'text-4xl text-primary-comfy-canvas lg:text-6xl/tight'
            )
          "
        >
          {{ t(hero.titleKey, locale)
          }}<span
            v-if="hero.titleRestKey"
            :class="
              isOverlay
                ? 'text-primary-warm-white/80'
                : 'text-primary-comfy-canvas/80'
            "
            >{{ t(hero.titleRestKey, locale) }}</span
          >
        </h1>

        <p
          v-if="hero.descriptionKey"
          :class="
            cn(
              'mt-6 text-base/relaxed font-light lg:text-lg/relaxed',
              isOverlay
                ? 'max-w-2xl text-primary-warm-white'
                : 'text-primary-comfy-canvas'
            )
          "
        >
          {{ t(hero.descriptionKey, locale) }}
        </p>

        <div class="mt-8 flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
          <BrandButton
            :href="hero.primaryCta.href"
            :target="hero.primaryCta.target"
            :variant="isOverlay ? 'canvas' : 'solid'"
            size="lg"
            class="w-full p-4 text-center lg:w-auto lg:min-w-52"
          >
            {{ t(hero.primaryCta.labelKey, locale) }}
          </BrandButton>
          <BrandButton
            v-if="hero.secondaryCta"
            :href="hero.secondaryCta.href"
            :target="hero.secondaryCta.target"
            variant="outline"
            size="lg"
            class="w-full p-4 text-center lg:w-auto lg:min-w-52"
          >
            {{ t(hero.secondaryCta.labelKey, locale) }}
          </BrandButton>
        </div>

        <div
          v-if="hero.badgeKeys?.length"
          class="mt-6 flex flex-wrap items-center justify-center gap-3"
        >
          <Badge
            v-for="badgeKey in hero.badgeKeys"
            :key="badgeKey"
            variant="subtle"
          >
            {{ t(badgeKey, locale) }}
          </Badge>
        </div>

        <p
          v-if="hero.footnoteKey"
          :class="
            cn(
              'mt-6 text-xs',
              isOverlay
                ? 'text-primary-warm-white/80'
                : 'text-primary-warm-gray'
            )
          "
        >
          {{ t(hero.footnoteKey, locale) }}
        </p>
      </div>
    </div>
  </section>
</template>
