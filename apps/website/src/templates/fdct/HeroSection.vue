<script setup lang="ts">
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'

import HeroCentered01 from '../../components/blocks/HeroCentered01.vue'
import Button from '../../components/ui/button/Button.vue'
import { useParallax } from '../../composables/useParallax'
import { localizeHref } from '../../config/routes'
import { fdctPage } from '../../data/fdct'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// FPO collage art — swap for final FDCT imagery when supplied. Widths
// collapse with the free margin beside the centered hero text so the
// images never run under the headline or subtitle at narrow desktops.
// Distinct parallaxY per image gives the collage scroll depth.
const collageImages = [
  {
    src: 'https://media.comfy.org/website/gallery/desert.webp',
    class: 'left-[1.75%] top-16 aspect-[185/256] w-[185px]',
    parallaxY: 160
  },
  {
    src: 'https://media.comfy.org/website/gallery/gallery.webp',
    class:
      'left-[1.75%] top-[358px] aspect-[334/202] w-[min(334px,calc(50vw-450px))]',
    parallaxY: 260
  },
  {
    src: 'https://media.comfy.org/website/enterprise/dark-fluid-texture.webp',
    class:
      'right-[-4%] top-[88px] aspect-[311/175] w-[min(311px,calc(50vw-390px))]',
    parallaxY: 120
  },
  {
    src: 'https://media.comfy.org/website/careers/team2.webp',
    class:
      'right-[6%] top-[259px] aspect-[234/294] w-[min(234px,calc(50vw-510px))]',
    parallaxY: 200
  }
]

const sectionRef = ref<HTMLElement>()
const imageRefs = collageImages.map(() => ref<HTMLElement>())

// The hero sits at the top of the page, so start the scrub at 'top top' —
// images rest at their design positions on load and drift as you scroll.
const parallaxOpts = {
  trigger: sectionRef,
  start: 'top top',
  mediaQuery: '(min-width: 1280px)'
}

collageImages.forEach((image, index) => {
  useParallax([imageRefs[index]], { ...parallaxOpts, y: image.parallaxY })
})
</script>

<template>
  <section ref="sectionRef" class="relative pt-24 pb-16 lg:pt-40 lg:pb-44">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 hidden xl:block"
    >
      <img
        v-for="(image, index) in collageImages"
        :key="image.src"
        :ref="imageRefs[index]"
        :src="image.src"
        alt=""
        loading="lazy"
        class="absolute rounded-3xl object-cover"
        :class="image.class"
      />
    </div>

    <HeroCentered01
      :title="t('fdct.hero.title', locale)"
      :subtitle="t('fdct.hero.subtitle', locale)"
    >
      <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Button
          :href="localizeHref(fdctPage.ctas.contact, locale)"
          variant="default"
          size="lg"
        >
          {{ t('fdct.hero.contactCta', locale) }}
        </Button>
        <Button :href="fdctPage.ctas.applyFdct" variant="outline" size="lg">
          {{ t('fdct.hero.applyCta', locale) }}
        </Button>
      </div>
    </HeroCentered01>
  </section>
</template>
