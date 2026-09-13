<script setup lang="ts">
import { useElementVisibility } from '@vueuse/core'
import { ref, useTemplateRef, watch } from 'vue'

import { useAutoAdvance } from '../../composables/useAutoAdvance'
import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

interface Slide {
  title: string
  href: string
  media: string
  mediaType: 'video' | 'image'
  author: string
  avatar: string
  tags: string[]
}

const HUB = 'https://comfy-hub-assets.comfy.org/uploads'
const WORKFLOWS = 'https://comfy.org/workflows'

/** Mirror of the workflows page's FEATURED · STAFF PICK carousel. */
const slides: Slide[] = [
  {
    title: 'Product Advertisement Video',
    href: `${WORKFLOWS}/c98e5c457e1e-c98e5c457e1e/`,
    media: `${HUB}/a8c26beb-d463-40a0-8547-fa942e53ad70.mp4`,
    mediaType: 'video',
    author: 'Rob',
    avatar: `${HUB}/a3578974-5cb8-40ab-9753-9c401fa198bb.png`,
    tags: ['Product', 'Video']
  },
  {
    title: 'MiniMax H3: Image to Video',
    href: `${WORKFLOWS}/a781503cf508-a781503cf508/`,
    media: `${HUB}/22c1098d-1f6e-4d25-82f6-2c74c72cb665.mp4`,
    mediaType: 'video',
    author: 'ComfyUI',
    avatar: `${HUB}/a04e16f3-d01d-4118-b6e1-9ad00f0da3cf.png`,
    tags: ['Video', 'Image to Video']
  },
  {
    title: 'MiniMax H3: Reference to Video',
    href: `${WORKFLOWS}/46a303cbccf9-46a303cbccf9/`,
    media: `${HUB}/69e5b4bc-2650-494d-94e9-ae50dcbcde45.mp4`,
    mediaType: 'video',
    author: 'ComfyUI',
    avatar: `${HUB}/a04e16f3-d01d-4118-b6e1-9ad00f0da3cf.png`,
    tags: ['Video', 'Reference to Video']
  },
  {
    title: 'MiniMax H3: Text to Video',
    href: `${WORKFLOWS}/e8099b642c9f-e8099b642c9f/`,
    media: `${HUB}/e3086841-eb1c-4d26-939d-9b7886d7fd9a.mp4`,
    mediaType: 'video',
    author: 'ComfyUI',
    avatar: `${HUB}/a04e16f3-d01d-4118-b6e1-9ad00f0da3cf.png`,
    tags: ['Text to Video', 'Video']
  },
  {
    title: 'Topaz: Image Enhance Bloom 2',
    href: `${WORKFLOWS}/1c0a3a9faad3-1c0a3a9faad3/`,
    media: `${HUB}/549fd615-446c-44bd-a225-e60ad4634f12.png`,
    mediaType: 'image',
    author: 'ComfyUI',
    avatar: `${HUB}/a04e16f3-d01d-4118-b6e1-9ad00f0da3cf.png`,
    tags: ['API', 'Image Upscale']
  },
  {
    title: 'FLUX 3 Video: Text to Video',
    href: `${WORKFLOWS}/182021fcf3dc-182021fcf3dc/`,
    media: `${HUB}/5d8fc016-bf9f-4bef-af85-7af8b8c05345.mp4`,
    mediaType: 'video',
    author: 'ComfyUI',
    avatar: `${HUB}/a04e16f3-d01d-4118-b6e1-9ad00f0da3cf.png`,
    tags: ['Partner Nodes', 'Text to Video']
  }
]

const active = ref(0)
const sectionRef = useTemplateRef<HTMLElement>('sectionRef')
const onScreen = useElementVisibility(sectionRef)
const hovering = ref(false)

function go(step: number) {
  active.value = (active.value + step + slides.length) % slides.length
}

/** Self-advancing while on screen. Hovering holds the cycle and hands back on
 * a shorter fuse; an arrow press restarts the dwell clock so the carousel
 * never auto-advances right after a manual click. */
const DWELL_MS = 6000
const RESUME_MS = 3000

const { restart, resume } = useAutoAdvance({
  onScreen,
  held: hovering,
  dwellMs: DWELL_MS,
  resumeMs: RESUME_MS,
  onAdvance: () => go(1)
})

function pick(step: number) {
  go(step)
  restart()
}

/** Keyed by slide index; image slides have no entry. */
const videoEls: Record<number, HTMLVideoElement | undefined> = {}
function setVideoEl(index: number, el: unknown) {
  videoEls[index] = (el as HTMLVideoElement | null) ?? undefined
}

/** Only the displayed slide's video plays: advancing pauses the outgoing
 * video and rewinds and starts the incoming one; scrolling away pauses. */
watch([active, onScreen], ([current, visible], [previous]) => {
  if (previous !== current) videoEls[previous]?.pause()
  const video = videoEls[current]
  if (!video) return
  if (visible && !prefersReducedMotion()) {
    if (previous !== current) video.currentTime = 0
    video.play().catch(() => {})
  } else {
    video.pause()
  }
})
</script>

<template>
  <section class="max-w-9xl mx-auto w-full p-6 md:py-10 lg:px-12">
    <div
      ref="sectionRef"
      class="relative h-[clamp(300px,44vw,520px)] rounded-[2.5rem] border-[1.5px] border-white/15"
      role="region"
      aria-roledescription="carousel"
      :aria-label="t('featuredWorkflows.label', locale)"
      @pointerenter="hovering = true"
      @pointerleave="((hovering = false), resume())"
    >
      <div
        class="absolute inset-[3px] overflow-hidden rounded-[calc(2.5rem-4px)]"
      >
        <div
          class="flex h-full transition-transform duration-500 ease-out"
          :style="{ transform: `translate3d(-${active * 100}%, 0, 0)` }"
        >
          <div
            v-for="(slide, i) in slides"
            :key="slide.href"
            class="relative h-full min-w-0 flex-[0_0_100%]"
          >
            <video
              v-if="slide.mediaType === 'video'"
              :ref="(el) => setVideoEl(i, el)"
              :src="slide.media"
              class="size-full object-cover"
              :preload="i === active ? 'auto' : 'none'"
              muted
              loop
              playsinline
              disablepictureinpicture
            />
            <img
              v-else
              :src="slide.media"
              alt=""
              loading="lazy"
              class="size-full object-cover"
            />

            <div
              class="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent to-black/70"
              aria-hidden="true"
            />

            <a
              :href="slide.href"
              :aria-label="slide.title"
              class="focus-visible:ring-primary-comfy-yellow absolute inset-0 z-10 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
            />

            <div
              class="absolute top-3 left-3 z-20 rounded-[12px] bg-black/10 px-3.5 py-1.5 backdrop-blur-xs"
            >
              <span class="text-xs font-extrabold tracking-wide text-white">
                {{ t('featuredWorkflows.label', locale) }}
              </span>
            </div>

            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 p-4 pr-24 sm:gap-3 sm:p-6 sm:pr-32 lg:p-8 lg:pr-40"
            >
              <h2
                class="max-w-3xl text-[clamp(1.25rem,4vw,3rem)] leading-tight font-normal tracking-[-0.03em] text-white"
              >
                {{ slide.title }}
              </h2>
              <div class="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                <span class="flex min-w-0 items-center gap-2 text-white/95">
                  <img
                    :src="slide.avatar"
                    :alt="slide.author"
                    loading="lazy"
                    class="size-5 shrink-0 rounded-full object-cover sm:size-6"
                  />
                  <span class="truncate text-sm sm:text-base">
                    {{ slide.author }}
                  </span>
                </span>
                <span
                  v-for="tag in slide.tags"
                  :key="tag"
                  class="rounded-full bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur-xs"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="absolute right-6 bottom-6 z-30 flex gap-2 lg:right-8 lg:bottom-8"
      >
        <button
          type="button"
          class="flex size-11 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-xs transition-colors hover:bg-white/20"
          :aria-label="t('featuredWorkflows.prev', locale)"
          @click="pick(-1)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="size-5"
            aria-hidden="true"
          >
            <path
              d="M15 6l-6 6 6 6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="flex size-11 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-xs transition-colors hover:bg-white/20"
          :aria-label="t('featuredWorkflows.next', locale)"
          @click="pick(1)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="size-5"
            aria-hidden="true"
          >
            <path
              d="M9 6l6 6-6 6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </section>
</template>
