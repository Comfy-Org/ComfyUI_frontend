<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useIntersectionObserver } from '@vueuse/core'
import { ref, useTemplateRef, watch } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import LottieVideoPlayer from '../common/LottieVideoPlayer.vue'
import NodeBadge from '../common/NodeBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const SCENE3_LOTTIE_PATH = '/animations/scene3/scene3.json'
const SCENE3_ASSETS_PATH =
  'https://media.comfy.org/website/homepage/showcase/scene3/'
const SCENE3_POSTER_PATH = `${SCENE3_ASSETS_PATH}poster.webp`

type Feature = {
  title: string
  description: string
  video?: string
  lottie?: { src: string; assetsPath?: string; poster?: string }
}

const features: Feature[] = [
  {
    title: t('showcase.feature1.title', locale),
    description: t('showcase.feature1.description', locale),
    video:
      'https://media.comfy.org/website/homepage/showcase/node-workflow.webm'
  },
  {
    title: t('showcase.feature2.title', locale),
    description: t('showcase.feature2.description', locale),
    video: 'https://media.comfy.org/website/homepage/showcase/ui-overview.webm'
  },
  {
    title: t('showcase.feature3.title', locale),
    description: t('showcase.feature3.description', locale),
    lottie: {
      src: SCENE3_LOTTIE_PATH,
      assetsPath: SCENE3_ASSETS_PATH,
      poster: SCENE3_POSTER_PATH
    }
  }
]

const badgeSegments = [
  { text: t('showcase.badgeHow', locale) },
  { logoSrc: '/icons/logo.svg', logoAlt: 'Comfy' },
  { text: t('showcase.badgeWorks', locale) }
]

const activeIndex = ref(0)
const videoRefs = new Map<number, HTMLVideoElement>()
const setVideoRef = (index: number) => (el: unknown) => {
  if (el instanceof HTMLVideoElement) videoRefs.set(index, el)
  else videoRefs.delete(index)
}
const sectionRef = useTemplateRef<HTMLElement>('sectionRef')
const isVisible = ref(false)

useIntersectionObserver(sectionRef, ([entry]) => {
  isVisible.value = entry?.isIntersecting ?? false
})

watch(activeIndex, (current, previous) => {
  videoRefs.get(previous)?.pause()
  const activeVideo = videoRefs.get(current)
  if (activeVideo) {
    activeVideo.currentTime = 0
    activeVideo.play().catch(() => {})
  }
})
</script>

<template>
  <section ref="sectionRef" class="px-4 py-20 lg:px-20 lg:py-24">
    <!-- Section header -->
    <div class="flex flex-col items-center text-center">
      <NodeBadge :segments="badgeSegments" segment-class="" />
      <p class="text-primary-comfy-canvas mt-12 max-w-xl text-sm/relaxed">
        {{ t('showcase.subtitle1', locale) }}
      </p>
      <p class="text-primary-comfy-canvas mt-4 max-w-xl text-sm/relaxed">
        {{ t('showcase.subtitle2', locale) }}
      </p>
    </div>

    <!-- Content area -->
    <div class="mt-12 flex flex-col lg:mt-24 lg:flex-row lg:items-stretch">
      <!-- Video area (desktop only) -->
      <div class="hidden flex-1 lg:flex">
        <div
          :class="
            cn(
              'rounded-5xl relative flex w-full items-center justify-center overflow-hidden p-0.5',
              isVisible && 'animate-border-spin'
            )
          "
        >
          <div
            class="bg-primary-comfy-ink relative size-full overflow-hidden rounded-[calc(2.5rem-2px)]"
          >
            <template v-for="(feature, i) in features" :key="feature.title">
              <video
                v-if="feature.video"
                :ref="setVideoRef(i)"
                :src="feature.video"
                :autoplay="i === 0"
                :preload="i === 0 ? 'metadata' : 'none'"
                loop
                muted
                playsinline
                :class="
                  cn(
                    'absolute inset-0 size-full object-cover transition-opacity duration-300 will-change-[opacity]',
                    activeIndex === i ? 'opacity-100' : 'opacity-0'
                  )
                "
              />
              <LottieVideoPlayer
                v-else-if="feature.lottie && isVisible"
                :src="feature.lottie.src"
                :assets-path="feature.lottie.assetsPath"
                :poster="feature.lottie.poster"
                :playing="activeIndex === i"
                poster-class="bg-transparency-white-t4"
                :class="
                  cn(
                    'bg-transparency-white-t4 absolute inset-0 size-full transition-opacity duration-300 will-change-[opacity]',
                    activeIndex === i ? 'opacity-100' : 'opacity-0'
                  )
                "
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
              class="animate-border-spin size-full overflow-hidden rounded-4xl p-0.5"
            >
              <div
                class="bg-primary-comfy-ink size-full overflow-hidden rounded-[calc(2rem-2px)]"
              >
                <video
                  v-if="feature.video"
                  :src="feature.video"
                  autoplay
                  loop
                  muted
                  playsinline
                  class="size-full object-cover"
                />
                <LottieVideoPlayer
                  v-else-if="feature.lottie"
                  :src="feature.lottie.src"
                  :assets-path="feature.lottie.assetsPath"
                  :poster="feature.lottie.poster"
                  poster-class="bg-transparency-white-t4"
                  class="bg-transparency-white-t4 size-full"
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
            <button
              type="button"
              :class="
                cn(
                  'rounded-5xl w-full cursor-pointer p-8 text-left transition-colors duration-300',
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
                </div>
              </div>
            </button>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
