<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { gsap, ScrollTrigger } from '../../scripts/gsapSetup'

import { externalLinks } from '../../config/routes'
import BrandButton from '../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const sectionRef = ref<HTMLElement>()
const leftImgRef = ref<HTMLElement>()
const rightImgRef = ref<HTMLElement>()
let ctx: gsap.Context | undefined

onMounted(() => {
  ctx = gsap.context(() => {
    ;[leftImgRef.value, rightImgRef.value].forEach((el) => {
      if (!el) return
      gsap.to(el, {
        y: 200,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        }
      })
    })

    const section = sectionRef.value
    if (!section) return

    ScrollTrigger.matchMedia({
      '(max-width: 1023px)': () => {
        const proxy = { index: 0 }
        gsap.to(proxy, {
          index: categories.length - 1,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: `+=${categories.length * 100}%`,
            pin: true,
            scrub: true,
            refreshPriority: 1
          },
          onUpdate() {
            activeCategory.value = Math.round(proxy.index)
          }
        })
      }
    })
  })
})

onUnmounted(() => {
  ctx?.revert()
})

const categories = [
  t('useCase.vfx', locale),
  t('useCase.advertising', locale),
  t('useCase.gaming', locale),
  t('useCase.ecommerce', locale),
  t('useCase.more', locale)
]

const activeCategory = ref(0)
</script>

<template>
  <section
    ref="sectionRef"
    class="bg-primary-comfy-ink relative flex flex-col items-center overflow-hidden px-8 py-24 lg:px-0 lg:py-40"
  >
    <!-- Left image -->
    <div
      ref="leftImgRef"
      class="bg-primary-comfy-canvas/20 rounded-r-5xl absolute top-100 left-0 h-40 w-1/8 lg:h-160 lg:w-1/4"
    />
    <!-- Right image -->
    <div
      ref="rightImgRef"
      class="bg-primary-comfy-canvas/20 rounded-l-5xl absolute top-40 right-0 h-40 w-1/8 lg:h-160 lg:w-1/4"
    />
    <p
      class="text-primary-comfy-yellow text-center text-sm font-bold tracking-widest uppercase lg:text-base"
    >
      {{ t('useCase.label', locale) }}
    </p>

    <nav
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
  </section>
</template>
