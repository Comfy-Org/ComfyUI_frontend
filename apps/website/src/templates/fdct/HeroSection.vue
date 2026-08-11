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

type CollageMedia = {
  src: string
  class: string
  parallaxY?: number
  video?: boolean
  poster?: string
}

// Final FDCT collage media, boxed at native aspect ratios. Widths collapse
// with the free margin beside the centered hero text so the media never run
// under the headline or subtitle at narrow desktops. Distinct parallaxY per
// item gives the collage scroll depth.
const collageImages: CollageMedia[] = [
  {
    src: 'https://media.comfy.org/website/fdct/012_abeautifulland-capemetalhurlant-urrealvi_00001_.jpg',
    class: 'left-[1.75%] top-16 aspect-[7/4] w-[min(300px,calc(50vw-450px))]',
    parallaxY: 160
  },
  {
    src: 'https://media.comfy.org/website/fdct/d13c25f5-c92a-4486-a300-87e1a4b965dd.mp4',
    poster:
      'https://media.comfy.org/website/fdct/d13c25f5-c92a-4486-a300-87e1a4b965dd_thumb.jpeg',
    video: true,
    class:
      'left-[1.75%] top-[290px] aspect-video w-[min(334px,calc(50vw-450px))]',
    parallaxY: 260
  },
  {
    src: 'https://media.comfy.org/website/fdct/headphones.png',
    class:
      'right-[-4%] top-[72px] aspect-[4/3] w-[min(280px,calc(50vw-390px))]',
    parallaxY: 120
  },
  {
    src: 'https://media.comfy.org/website/fdct/af782285-9fa2-4d4c-a405-7018664d9f49.mp4',
    poster:
      'https://media.comfy.org/website/fdct/af782285-9fa2-4d4c-a405-7018664d9f49_thumb.jpeg',
    video: true,
    class:
      'right-[6%] top-[310px] aspect-[9/16] w-[min(170px,calc(50vw-510px))]',
    parallaxY: 200
  }
]

// Below xl the collage collapses into a static three-item stack under the
// CTAs (design 10373:39106), mapped from the same media set by aspect ratio.
// The portrait desktop video has no slot in the mobile layout.
const mobileCollageImages: CollageMedia[] = [
  {
    src: 'https://media.comfy.org/website/fdct/headphones.png',
    class: 'right-[-9%] top-0 aspect-[4/3] w-[48%]'
  },
  {
    src: 'https://media.comfy.org/website/fdct/012_abeautifulland-capemetalhurlant-urrealvi_00001_.jpg',
    class: 'left-[-7%] top-6 aspect-[7/4] w-[44%]'
  },
  {
    src: 'https://media.comfy.org/website/fdct/d13c25f5-c92a-4486-a300-87e1a4b965dd.mp4',
    poster:
      'https://media.comfy.org/website/fdct/d13c25f5-c92a-4486-a300-87e1a4b965dd_thumb.jpeg',
    video: true,
    class: 'left-[21%] top-[150px] aspect-video w-[62%]'
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
  <section
    ref="sectionRef"
    class="relative overflow-x-clip pt-24 pb-16 lg:pt-40 lg:pb-44"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 hidden xl:block"
    >
      <template v-for="(image, index) in collageImages" :key="image.src">
        <video
          v-if="image.video"
          :ref="imageRefs[index]"
          :src="image.src"
          :poster="image.poster"
          autoplay
          muted
          loop
          playsinline
          class="absolute rounded-3xl object-cover"
          :class="image.class"
        />
        <img
          v-else
          :ref="imageRefs[index]"
          :src="image.src"
          alt=""
          loading="lazy"
          class="absolute rounded-3xl object-cover"
          :class="image.class"
        />
      </template>
    </div>

    <HeroCentered01
      :eyebrow="t('fdct.hero.eyebrow', locale)"
      :title="t('fdct.hero.title', locale)"
      :subtitle="t('fdct.hero.subtitle', locale)"
    >
      <div
        class="mt-10 flex w-full flex-col items-stretch gap-5 sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-4"
      >
        <Button
          :href="localizeHref(fdctPage.ctas.contact, locale)"
          variant="default"
          size="lg"
          class="h-12 text-sm sm:h-14 sm:text-base"
        >
          {{ t('fdct.hero.contactCta', locale) }}
        </Button>
      </div>
    </HeroCentered01>

    <div
      aria-hidden="true"
      class="relative mx-auto mt-8 h-76 w-full max-w-md xl:hidden"
    >
      <template v-for="image in mobileCollageImages" :key="image.src">
        <video
          v-if="image.video"
          :src="image.src"
          :poster="image.poster"
          autoplay
          muted
          loop
          playsinline
          class="absolute rounded-2xl object-cover"
          :class="image.class"
        />
        <img
          v-else
          :src="image.src"
          alt=""
          loading="lazy"
          class="absolute rounded-2xl object-cover"
          :class="image.class"
        />
      </template>
    </div>
  </section>
</template>
