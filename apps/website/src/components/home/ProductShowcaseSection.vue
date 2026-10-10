<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useIntersectionObserver } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'

import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import NodeBadge from '@/components/common/NodeBadge.vue'
import VideoPlayer from '@/components/common/VideoPlayer.vue'
import LottieScene from './LottieScene.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
const routes = getRoutes(locale)

interface Feature {
  title: string
  description: string
  cta: string
  href?: string
  lottie?: string
  video?: { src: string; poster?: string }
}

const features: Feature[] = [
  {
    title: t('showcase.feature1.title'),
    description: t('showcase.feature1.description'),
    cta: t('showcase.feature1.cta'),
    href: routes.download,
    // Vector scene from Comfy-Org/comfy-website-animations, replacing the
    // node-workflow.webm capture this slide used to play.
    lottie: '/animations/scene-1/scene-01.json'
  },
  {
    title: t('showcase.feature2.title'),
    description: t('showcase.feature2.description'),
    cta: t('showcase.feature2.cta'),
    href: routes.agent,
    video: {
      src: 'https://media.comfy.org/website/comfy-agent/homepage-agent-cut-03.mp4'
    }
  },
  {
    title: t('showcase.feature3.title'),
    description: t('showcase.feature3.description'),
    cta: t('showcase.feature3.cta'),
    href: routes.platformComfyApi,
    video: {
      src: 'https://media.comfy.org/website/comfy-api/homepage-api-cut-04.mp4'
    }
  }
]

const badgeSegments = [
  { text: t('showcase.badgeHow') },
  { logoSrc: '/icons/logo.svg', logoAlt: 'Comfy' },
  { text: t('showcase.badgeWorks') }
]

const activeIndex = ref(0)
const sectionRef = useTemplateRef<HTMLElement>('sectionRef')
const isVisible = ref(false)

useIntersectionObserver(sectionRef, ([entry]) => {
  isVisible.value = entry?.isIntersecting ?? false
})
</script>

<template>
  <section
    ref="sectionRef"
    class="mx-auto max-w-9xl px-4 py-20 lg:px-20 lg:py-24"
  >
    <!-- Section header -->
    <div class="flex flex-col items-center text-center">
      <NodeBadge :segments="badgeSegments" segment-class="" />
      <p class="mt-12 max-w-xl text-sm/relaxed text-primary-comfy-canvas">
        {{ t('showcase.subtitle1') }}
      </p>
      <p class="mt-4 max-w-xl text-sm/relaxed text-primary-comfy-canvas">
        {{ t('showcase.subtitle2') }}
      </p>
    </div>

    <!-- Content area -->
    <div class="mt-12 flex flex-col lg:mt-24 lg:flex-row lg:items-stretch">
      <!-- Video area (desktop only) -->
      <div class="hidden flex-1 lg:flex">
        <div
          :class="
            cn(
              'relative flex w-full items-center justify-center overflow-hidden rounded-5xl p-0.5',
              isVisible && 'animate-border-spin'
            )
          "
        >
          <div
            class="relative size-full overflow-hidden rounded-[calc(2.5rem-2px)] bg-transparency-white-t4"
          >
            <template v-for="(feature, i) in features" :key="feature.title">
              <LottieScene
                v-if="feature.lottie"
                :src="feature.lottie"
                :active="activeIndex === i"
                :class="
                  cn(
                    'absolute inset-0 size-full transition-opacity duration-300 will-change-[opacity]',
                    activeIndex === i ? 'opacity-100' : 'opacity-0'
                  )
                "
              />
              <!-- Mounted only while active so an idle tab never loads or
                plays its video. -->
              <VideoPlayer
                v-else-if="feature.video && activeIndex === i"
                :locale
                :src="feature.video.src"
                :poster="feature.video.poster"
                :aria-label="feature.title"
                autoplay
                lazy-autoplay
                loop
                hide-controls
                fit="contain"
                class="absolute inset-0 aspect-auto size-full rounded-none border-0"
              />
            </template>
          </div>
        </div>
      </div>

      <!-- Feature accordion -->
      <div class="flex w-full flex-col lg:w-85 lg:gap-4">
        <template v-for="(feature, i) in features" :key="feature.title">
          <!-- Video area (mobile, rendered before active item) -->
          <div
            v-if="activeIndex === i"
            :class="cn('aspect-video lg:hidden', i !== 0 && 'mt-4')"
          >
            <div
              class="size-full animate-border-spin overflow-hidden rounded-4xl p-0.5"
            >
              <div
                class="size-full overflow-hidden rounded-[calc(2rem-2px)] bg-transparency-white-t4"
              >
                <LottieScene
                  v-if="feature.lottie"
                  :src="feature.lottie"
                  class="size-full"
                />
                <VideoPlayer
                  v-else-if="feature.video"
                  :locale
                  :src="feature.video.src"
                  :poster="feature.video.poster"
                  :aria-label="feature.title"
                  autoplay
                  lazy-autoplay
                  loop
                  hide-controls
                  fit="contain"
                  class="aspect-auto size-full rounded-none border-0"
                />
              </div>
            </div>
          </div>

          <!-- Connector (mobile) -->
          <div
            v-if="activeIndex === i"
            class="flex h-5 items-center overflow-visible lg:hidden"
          >
            <img
              src="/icons/node-link.svg"
              alt=""
              class="ml-20 h-8 w-5 rotate-90"
              aria-hidden="true"
            />
          </div>

          <!-- Accordion item with connector -->
          <div
            :class="
              cn('flex items-stretch', activeIndex !== i && 'mt-4 lg:mt-0')
            "
          >
            <img
              v-if="activeIndex === i"
              src="/icons/node-link.svg"
              alt=""
              class="hidden self-center lg:block"
              aria-hidden="true"
            />
            <component
              :is="activeIndex === i && feature.href ? 'a' : 'button'"
              :href="activeIndex === i ? feature.href : undefined"
              :type="activeIndex === i && feature.href ? undefined : 'button'"
              :class="
                cn(
                  'w-full cursor-pointer rounded-5xl p-8 text-left transition-colors duration-300',
                  activeIndex === i
                    ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                    : 'bg-transparency-white-t4 text-primary-comfy-canvas lg:ml-5'
                )
              "
              @click="activeIndex = i"
            >
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-2xl/tight font-medium">
                  {{ feature.title }}
                </h3>
                <img
                  src="/icons/plus.svg"
                  alt=""
                  :class="
                    cn(
                      'size-5 shrink-0 transition-opacity duration-300',
                      activeIndex === i ? 'opacity-0' : 'opacity-100'
                    )
                  "
                  aria-hidden="true"
                />
              </div>

              <!-- Animated description (stacked for constant height) -->
              <div
                :class="
                  cn(
                    'grid transition-[grid-template-rows] duration-300',
                    activeIndex === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )
                "
              >
                <div class="grid overflow-hidden">
                  <p
                    v-for="(f, j) in features"
                    :key="f.title"
                    :class="
                      cn(
                        'col-start-1 row-start-1 mt-4 text-sm/relaxed font-normal opacity-80',
                        j === i ? 'visible' : 'invisible'
                      )
                    "
                  >
                    {{ f.description }}
                  </p>
                  <span
                    :class="
                      cn(
                        'col-start-1 row-start-2 mt-6 inline-flex h-10 w-fit items-center justify-center rounded-2xl border border-primary-comfy-ink px-6 py-2.5 text-xs font-bold tracking-wider text-primary-comfy-ink uppercase transition-opacity duration-300 md:text-sm',
                        activeIndex === i
                          ? 'opacity-100'
                          : 'invisible opacity-0'
                      )
                    "
                  >
                    {{ feature.cta }}
                  </span>
                </div>
              </div>
            </component>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
