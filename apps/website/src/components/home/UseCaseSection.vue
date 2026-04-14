<script setup lang="ts">
import { ref } from 'vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import { useParallax } from '../../composables/useParallax'
import { usePinScrub } from '../../composables/usePinScrub'
import BrandButton from '../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const categories = [
  t('useCase.vfx', locale),
  t('useCase.advertising', locale),
  t('useCase.gaming', locale),
  t('useCase.ecommerce', locale),
  t('useCase.more', locale)
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

useParallax([leftImgRef, rightImgRef], { trigger: sectionRef })
</script>

<template>
  <section
    ref="sectionRef"
    class="bg-primary-comfy-ink relative flex flex-col items-center overflow-hidden px-8 py-24 lg:h-screen lg:px-0 lg:py-40"
  >
    <!-- Left image -->
    <div
      ref="leftImgRef"
      class="bg-primary-comfy-canvas/20 rounded-r-5xl absolute top-80 left-0 h-40 w-1/8 lg:h-160 lg:w-1/4"
    />
    <!-- Right image -->
    <div
      ref="rightImgRef"
      class="bg-primary-comfy-canvas/20 rounded-l-5xl absolute top-30 right-0 h-40 w-1/8 lg:h-160 lg:w-1/4"
    />
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
        class="mt-24 flex max-w-5/6 flex-col items-center justify-center gap-12 lg:mt-40 lg:gap-20"
        aria-label="Industry categories"
      >
        <button
          v-for="(category, index) in categories"
          :key="category"
          class="lg:text-6.5xl cursor-pointer text-center text-4xl font-light whitespace-pre-line transition-colors"
          :class="
            index === activeCategory
              ? 'text-primary-comfy-canvas'
              : 'text-primary-comfy-canvas/30 hover:text-primary-comfy-canvas/50'
          "
          @click="activeCategory = index"
        >
          {{ category }}
        </button>
      </nav>

      <p class="text-primary-warm-gray mt-40 max-w-md text-center text-base">
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
