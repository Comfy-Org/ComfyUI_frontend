<script setup lang="ts">
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
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-12 lg:px-20 lg:py-16">
    <div v-if="hero.videoSrc" class="relative">
      <VideoPlayer :locale :src="hero.videoSrc" autoplay loop />
      <div
        v-if="hero.logoSrc"
        aria-hidden="true"
        class="bg-transparency-white-t4 pointer-events-none absolute top-6 right-6 flex size-12 items-center justify-center rounded-2xl backdrop-blur-sm lg:top-10 lg:right-10 lg:size-[70px] lg:rounded-3xl"
      >
        <span
          class="text-primary-warm-white inline-block size-6 bg-current lg:size-[35px]"
          :style="{
            maskImage: `url(${hero.logoSrc})`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center'
          }"
        />
      </div>
    </div>

    <div class="mx-auto mt-10 flex max-w-2xl flex-col items-center text-center">
      <p
        v-if="hero.eyebrowKey"
        class="text-primary-comfy-yellow mb-4 text-sm font-extrabold tracking-wider uppercase"
      >
        {{ t(hero.eyebrowKey, locale) }}
      </p>

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

      <div class="mt-8 flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
        <BrandButton
          :href="hero.primaryCta.href"
          :target="hero.primaryCta.target"
          variant="solid"
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

      <p v-if="hero.footnoteKey" class="text-primary-warm-gray mt-6 text-xs">
        {{ t(hero.footnoteKey, locale) }}
      </p>
    </div>
  </section>
</template>
