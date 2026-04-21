<script setup lang="ts">
import { ref } from 'vue'

import { useHeroAnimation } from '../../composables/useHeroAnimation'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import VideoPlayer from '../common/VideoPlayer.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const sectionRef = ref<HTMLElement>()
const logoRef = ref<HTMLElement>()
const labelRef = ref<HTMLElement>()
const headingRef = ref<HTMLElement>()
const bodyRef = ref<HTMLElement>()
const ctaRef = ref<HTMLElement>()
const videoRef = ref<HTMLElement>()

useHeroAnimation({
  section: sectionRef,
  textEls: [labelRef, headingRef, bodyRef, ctaRef],
  logo: logoRef,
  video: videoRef
})
</script>

<template>
  <section ref="sectionRef" class="pt-12 lg:pt-20">
    <div
      class="flex flex-col items-center text-center lg:flex-row lg:items-start lg:text-left"
    >
      <!-- Graphic -->
      <div
        ref="logoRef"
        class="order-2 mt-8 w-full lg:order-1 lg:mt-0 lg:w-5/12"
      >
        <img
          src="https://media.comfy.org/website/about/c.webp"
          alt="Comfy 3D logo"
          class="mx-auto w-full max-w-md lg:max-w-none"
        />
      </div>

      <!-- Text -->
      <div
        class="order-1 flex flex-col items-center lg:order-2 lg:w-7/12 lg:items-start lg:pt-24 lg:pl-12"
      >
        <span
          ref="labelRef"
          class="text-primary-comfy-yellow text-xs font-semibold tracking-widest uppercase"
        >
          {{ t('about.hero.label', locale) }}
        </span>
        <h1
          ref="headingRef"
          class="text-primary-comfy-canvas mt-4 text-4xl/tight font-light lg:text-6xl"
        >
          {{ t('about.hero.heading', locale) }}
        </h1>
        <p ref="bodyRef" class="text-primary-warm-gray mt-6 max-w-sm text-base">
          {{ t('about.hero.body', locale) }}
        </p>
        <div ref="ctaRef" class="mt-8">
          <BrandButton
            :href="locale === 'zh-CN' ? '/zh-CN/careers' : '/careers'"
            variant="outline"
            class="rounded-full"
          >
            {{ t('about.hero.cta', locale) }}
          </BrandButton>
        </div>
      </div>
    </div>

    <!-- Video overlapping the hero graphic -->
    <div ref="videoRef" class="-mt-16 px-20 pb-40 lg:-mt-72">
      <VideoPlayer
        src="https://media.comfy.org/website/about/co-founders.webm"
        poster="https://media.comfy.org/website/about/co-founders-poster.webp"
        :tracks="[
          {
            src: 'https://media.comfy.org/website/about/co-founders.en.vtt',
            kind: 'subtitles',
            srclang: 'en',
            label: 'English'
          },
          {
            src: 'https://media.comfy.org/website/about/co-founders.desc.vtt',
            kind: 'descriptions',
            srclang: 'en',
            label: 'Descriptions'
          }
        ]"
        :locale
      />
    </div>
  </section>
</template>
