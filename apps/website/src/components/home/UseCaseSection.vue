<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import { useParallax } from '../../composables/useParallax'
import { usePinScrub } from '../../composables/usePinScrub'
import BrandButton from '../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const categories = [
  {
    label: t('useCase.vfx', locale),
    leftImg: '/images/homepage/use-case-left-1.webp',
    rightImg: '/images/homepage/use-case-right-1.webp'
  },
  {
    label: t('useCase.advertising', locale),
    leftImg: '/images/homepage/use-case-left-2.webp',
    rightImg: '/images/homepage/use-case-right-2.webp'
  },
  {
    label: t('useCase.gaming', locale),
    leftImg: '/images/homepage/use-case-left-3.webp',
    rightImg: '/images/homepage/use-case-right-3.webp'
  },
  {
    label: t('useCase.ecommerce', locale),
    leftImg: '/images/homepage/use-case-left-4.webp',
    rightImg: '/images/homepage/use-case-right-4.webp'
  },
  {
    label: t('useCase.more', locale),
    leftImg: '/images/homepage/use-case-left-5.webp',
    rightImg: '/images/homepage/use-case-right-5.webp'
  }
]

const sectionRef = ref<HTMLElement>()
const contentRef = ref<HTMLElement>()
const navRef = ref<HTMLElement>()
const leftImgRef = ref<HTMLElement>()
const rightImgRef = ref<HTMLElement>()

const { activeIndex: activeCategory } = usePinScrub(
  { section: sectionRef, content: contentRef, nav: navRef },
  { itemCount: categories.length }
)

const activeLeft = computed(() => categories[activeCategory.value].leftImg)
const activeRight = computed(() => categories[activeCategory.value].rightImg)
const activeLabel = computed(() => categories[activeCategory.value].label)

const uid = useId()
const leftBlobId = `left-blob-${uid}`
const rightBlobId = `right-blob-${uid}`

useParallax([rightImgRef], { trigger: sectionRef })
useParallax([leftImgRef], { trigger: sectionRef, y: -60 })
</script>

<template>
  <section
    ref="sectionRef"
    class="bg-primary-comfy-ink relative flex flex-col items-center overflow-hidden px-8 py-20 lg:h-[calc(100vh+60px)] lg:px-0 lg:py-24"
  >
    <!-- Clip-path definitions for shaped images -->
    <svg class="absolute" width="0" height="0" aria-hidden="true">
      <defs>
        <clipPath :id="leftBlobId" clipPathUnits="objectBoundingBox">
          <path
            d="M0.314,0.988 C0.337,0.997 0.366,0.999 0.398,0.993 L0.600,0.949 L0.877,0.890 C0.945,0.876 1.000,0.828 1.000,0.784 L1.000,0.206 L1.000,0.195 L0.999,0.061 C0.999,0.040 0.986,0.021 0.962,0.011 C0.939,0.001 0.910,-0.001 0.879,0.007 L0.675,0.050 L0.398,0.109 C0.331,0.123 0.277,0.171 0.277,0.215 L0.277,0.314 C0.277,0.324 0.266,0.333 0.251,0.337 L0.121,0.365 C0.054,0.379 0.000,0.427 0.000,0.471 L0.000,0.504 L0.000,0.802 C0.000,0.823 0.014,0.841 0.037,0.851 C0.060,0.861 0.089,0.863 0.121,0.856 L0.229,0.833 C0.240,0.830 0.252,0.831 0.261,0.835 C0.270,0.839 0.275,0.845 0.275,0.852 L0.276,0.939 C0.276,0.960 0.289,0.978 0.314,0.988 Z"
          />
        </clipPath>
        <clipPath :id="rightBlobId" clipPathUnits="objectBoundingBox">
          <path
            d="M1,0.129 L0.187,0.005 C0.084,0 0,0.015 0,0.066 L0,0.104 L0,0.447 C0,0.472 0.022,0.500 0.058,0.523 C0.094,0.547 0.139,0.563 0.188,0.571 L0.356,0.599 C0.373,0.602 0.391,0.609 0.405,0.618 C0.419,0.627 0.427,0.637 0.427,0.645 L0.427,0.745 C0.427,0.770 0.448,0.798 0.485,0.821 C0.521,0.845 0.566,0.861 0.615,0.869 L0.734,0.890 L0.934,0.923 L1,0.934 Z"
          />
        </clipPath>
      </defs>
    </svg>
    <!-- Left image -->
    <div
      ref="leftImgRef"
      class="absolute top-80 left-0 h-50 w-1/4 -translate-x-2/5 overflow-hidden lg:h-240 lg:max-h-3/4"
      :style="`clip-path: url(#${leftBlobId})`"
    >
      <Transition name="crossfade">
        <img
          :key="activeLeft"
          :src="activeLeft"
          :alt="activeLabel"
          class="absolute inset-0 size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </Transition>
    </div>
    <div
      ref="rightImgRef"
      class="absolute top-30 right-0 h-50 w-1/4 translate-x-2/5 overflow-hidden lg:h-240 lg:max-h-3/4"
      :style="`clip-path: url(#${rightBlobId})`"
    >
      <Transition name="crossfade">
        <img
          :key="activeRight"
          :src="activeRight"
          :alt="activeLabel"
          class="absolute inset-0 size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </Transition>
    </div>
    <div
      ref="contentRef"
      class="flex flex-col items-center will-change-transform"
    >
      <p
        class="text-primary-comfy-yellow text-center text-sm font-bold tracking-widest uppercase lg:text-base"
      >
        {{ t('useCase.label', locale) }}
      </p>

      <nav
        ref="navRef"
        class="mt-16 flex max-w-5/6 flex-col items-center justify-center gap-12 lg:mt-20 lg:gap-20"
        aria-label="Industry categories"
      >
        <button
          v-for="(category, index) in categories"
          :key="category.label"
          class="lg:text-6.5xl cursor-pointer text-center text-4xl font-light whitespace-pre-line transition-colors"
          :class="
            index === activeCategory
              ? 'text-primary-comfy-canvas'
              : 'text-primary-comfy-canvas/30 hover:text-primary-comfy-canvas/50'
          "
          @click="activeCategory = index"
        >
          {{ category.label }}
        </button>
      </nav>

      <p class="text-primary-warm-gray mt-20 max-w-md text-center text-base">
        {{ t('useCase.body', locale) }}
      </p>

      <BrandButton
        :href="externalLinks.workflows"
        :label="t('useCase.cta', locale)"
        variant="outline"
        class-name="mt-8 text-sm"
      />
    </div>
  </section>
</template>
