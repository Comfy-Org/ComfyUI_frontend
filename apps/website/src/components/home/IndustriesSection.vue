<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref, useId } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { externalLinks } from '../../config/routes'
import BrandButton from '../common/BrandButton.vue'
import BlobMedia from './BlobMedia.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

interface Industry {
  label: string
  primarySrc: string
  secondarySrc: string
  secondaryObjectPosition?: 'top' | 'bottom' | 'center'
}

const MEDIA_BASE = 'https://media.comfy.org/website/homepage/use-case'

const industries: Industry[] = [
  {
    label: t('industries.vfx', locale),
    primarySrc: `${MEDIA_BASE}/left1.webm`,
    secondarySrc: `${MEDIA_BASE}/right1.webm`
  },
  {
    label: t('industries.advertising', locale),
    primarySrc: `${MEDIA_BASE}/left2.webm`,
    secondarySrc: `${MEDIA_BASE}/right2.webm`
  },
  {
    label: t('industries.gaming', locale),
    primarySrc: `${MEDIA_BASE}/left3.webm`,
    secondarySrc: `${MEDIA_BASE}/right3.webp`
  },
  {
    label: t('industries.ecommerce', locale),
    primarySrc: `${MEDIA_BASE}/left4.webm`,
    secondarySrc: `${MEDIA_BASE}/right4.webm`,
    secondaryObjectPosition: 'top'
  }
]

/** Third tile in the cluster; a constant community reel rather than an
 * industry-specific one, so the collage always has three live surfaces. */
const ambientSrc = `${MEDIA_BASE}/left5.webm`

const activeIndex = ref(0)
const active = computed(() => industries[activeIndex.value])

const uid = useId()
const primaryClipId = `industries-primary-${uid}`
const secondaryClipId = `industries-secondary-${uid}`
const ambientClipId = `industries-ambient-${uid}`
</script>

<template>
  <section class="relative overflow-x-clip bg-primary-comfy-ink">
    <!-- Node silhouettes hand-traced from the industries design mock. -->
    <svg class="absolute size-0" width="0" height="0" aria-hidden="true">
      <defs>
        <clipPath :id="primaryClipId" clipPathUnits="objectBoundingBox">
          <path
            d="M0.276,0 L0.603,0 C0.82,0 1,0.075 1,0.213 L1,0.568 C1,0.585 0.99,0.594 0.972,0.596 C0.962,0.598 0.958,0.606 0.958,0.617 L0.958,0.845 C0.958,0.872 0.94,0.887 0.90,0.887 L0.37,0.887 C0.325,0.887 0.253,0.887 0.253,0.838 L0.253,0.670 C0.253,0.645 0.238,0.630 0.205,0.628 L0.048,0.628 C0.018,0.628 0,0.612 0,0.588 L0,0.362 C0,0.345 0.01,0.334 0.03,0.332 C0.09,0.330 0.105,0.318 0.105,0.298 L0.105,0.17 C0.105,0.075 0.17,0 0.276,0 Z"
          />
        </clipPath>
        <clipPath :id="secondaryClipId" clipPathUnits="objectBoundingBox">
          <path
            d="M0.30,0 L0.60,0 C0.63,0 0.64,0.02 0.64,0.045 C0.64,0.06 0.655,0.0695 0.68,0.0695 L0.90,0.0695 C0.955,0.0695 1,0.10 1,0.155 L1,0.77 C1,0.83 0.97,0.88 0.915,0.925 C0.87,0.965 0.82,1 0.76,1 L0.36,1 C0.33,1 0.31,0.985 0.31,0.962 C0.31,0.93 0.295,0.905 0.255,0.905 L0.10,0.905 C0.04,0.905 0,0.868 0,0.81 L0,0.165 C0,0.115 0.03,0.0695 0.085,0.0695 L0.20,0.0695 C0.26,0.0695 0.28,0.045 0.28,0.03 C0.28,0.01 0.285,0 0.30,0 Z"
          />
        </clipPath>
        <clipPath :id="ambientClipId" clipPathUnits="objectBoundingBox">
          <path
            d="M0.27,0 L0.43,0 C0.455,0 0.468,0.04 0.472,0.09 L0.48,0.17 C0.487,0.225 0.505,0.258 0.53,0.258 L0.94,0.258 C0.975,0.258 1,0.31 1,0.385 L1,0.86 C1,0.945 0.973,1 0.932,1 L0.068,1 C0.028,1 0,0.945 0,0.862 L0,0.46 C0,0.39 0.022,0.34 0.055,0.335 C0.075,0.332 0.085,0.31 0.085,0.28 L0.085,0.09 C0.085,0.03 0.095,0 0.115,0 L0.27,0 Z"
          />
        </clipPath>
      </defs>
    </svg>

    <div
      class="max-w-9xl mx-auto grid grid-cols-1 gap-16 px-6 py-20 lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-20 lg:py-28"
    >
      <!-- Copy column -->
      <div class="flex flex-col items-start gap-10">
        <div class="flex flex-col gap-6">
          <p
            class="text-primary-comfy-yellow text-sm font-bold tracking-widest uppercase"
          >
            {{ t('industries.label', locale) }}
          </p>
          <p class="text-primary-warm-gray max-w-md text-lg/relaxed">
            {{ t('industries.body', locale) }}
          </p>
        </div>

        <nav
          class="flex flex-col items-start gap-7"
          :aria-label="t('industries.navLabel', locale)"
        >
          <button
            v-for="(industry, index) in industries"
            :key="industry.label"
            type="button"
            :class="
              cn(
                'flex cursor-pointer items-baseline gap-4 text-left text-3xl font-light transition-colors outline-none md:text-4xl',
                index === activeIndex
                  ? 'text-primary-comfy-yellow'
                  : 'text-primary-comfy-canvas/60 hover:text-primary-comfy-canvas focus-visible:text-primary-comfy-canvas'
              )
            "
            :aria-current="index === activeIndex ? 'true' : undefined"
            @click="activeIndex = index"
            @mouseenter="activeIndex = index"
            @focus="activeIndex = index"
          >
            <span
              v-if="index === activeIndex"
              class="bg-primary-comfy-yellow size-2.5 shrink-0 self-center rounded-full"
            />
            {{ industry.label }}
          </button>
        </nav>

        <BrandButton :href="externalLinks.workflows" variant="outline">
          {{ t('industries.cta', locale) }}
        </BrandButton>
      </div>

      <!-- Node-shaped media cluster -->
      <div
        class="relative mx-auto aspect-square w-full max-w-xl lg:mx-0 lg:justify-self-end"
        aria-hidden="true"
      >
        <div class="absolute top-[1%] left-[7%] h-[69%] w-[39%]">
          <BlobMedia :src="active.primarySrc" :clip-id="primaryClipId" />
        </div>
        <div class="absolute top-[9%] right-[10%] h-[63%] w-[42%]">
          <BlobMedia
            :src="active.secondarySrc"
            :clip-id="secondaryClipId"
            :object-position="active.secondaryObjectPosition"
          />
        </div>
        <div class="absolute bottom-[6%] left-[18%] h-[29%] w-[65%]">
          <BlobMedia :src="ambientSrc" :clip-id="ambientClipId" />
        </div>
      </div>
    </div>
  </section>
</template>
