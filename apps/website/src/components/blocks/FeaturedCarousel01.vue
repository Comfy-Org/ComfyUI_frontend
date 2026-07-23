<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, ref } from 'vue'

import IconButton from '../ui/icon-button/IconButton.vue'
import { prefersReducedMotion } from '../../composables/useReducedMotion'

type FeaturedSlideMedia = {
  type: 'image' | 'video'
  src: string
  alt: string
  poster?: string
}

export type FeaturedSlide = {
  id: string
  media: FeaturedSlideMedia
  eyebrow?: string
  title?: string
  showTitle?: boolean
  href?: string
}

const { slides, prevLabel, nextLabel } = defineProps<{
  slides: FeaturedSlide[]
  prevLabel: string
  nextLabel: string
}>()

const activeIndex = ref(0)

function goTo(index: number): void {
  const count = slides.length
  activeIndex.value = (index + count) % count
}

// Respect prefers-reduced-motion (WCAG 2.2.2): don't autoplay the looping
// slide video. Removing the reactive `autoplay` attribute only suppresses the
// initial play under SSR (the server can't read the client's preference and
// renders autoplay, so the browser starts playback before hydration) — so also
// pause on mount. The paused video falls back to its poster frame.
const reduceMotion = computed(() => prefersReducedMotion())

const pauseIfReduced = (el: unknown) => {
  if (el instanceof HTMLVideoElement && reduceMotion.value) el.pause()
}
</script>

<template>
  <div class="w-full px-6 lg:px-14">
    <div
      class="border-primary-warm-gray relative mx-auto max-w-[1446px] rounded-[38px] border p-1.5 lg:p-5"
      :data-active-index="activeIndex"
    >
      <div class="relative overflow-clip rounded-4xl lg:rounded-[38px]">
        <div
          class="flex"
          :class="
            prefersReducedMotion()
              ? undefined
              : 'transition-transform duration-500 ease-out'
          "
          :style="{ transform: `translateX(-${activeIndex * 100}%)` }"
        >
          <div
            v-for="(slide, index) in slides"
            :key="slide.id"
            class="relative aspect-video w-full shrink-0 md:aspect-1406/622"
            :aria-hidden="index !== activeIndex"
          >
            <img
              v-if="slide.media.type === 'image'"
              :src="slide.media.src"
              :alt="slide.media.alt"
              :loading="index === 0 ? 'eager' : 'lazy'"
              decoding="async"
              class="absolute inset-0 size-full object-cover object-center"
            />
            <video
              v-else
              :ref="pauseIfReduced"
              :src="slide.media.src"
              :poster="slide.media.poster"
              :aria-label="slide.media.alt"
              :autoplay="!reduceMotion"
              loop
              muted
              playsinline
              preload="metadata"
              class="absolute inset-0 size-full object-cover object-center"
            />
            <div class="absolute inset-0 bg-black/20" />

            <div
              v-if="slide.showTitle !== false && (slide.eyebrow || slide.title)"
              aria-hidden="true"
              class="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/80 via-black/40 to-transparent"
            />

            <div
              v-if="slide.showTitle !== false && (slide.eyebrow || slide.title)"
              class="absolute inset-x-6 bottom-6 flex flex-col gap-3 lg:right-56 lg:bottom-14 lg:left-[72px]"
            >
              <p
                v-if="slide.eyebrow"
                class="text-primary-comfy-yellow text-xs font-semibold tracking-wide uppercase"
              >
                {{ slide.eyebrow }}
              </p>
              <p
                v-if="slide.title"
                class="text-2xl font-light tracking-tight text-balance text-primary-comfy-canvas md:text-3xl lg:text-5xl/tight"
              >
                {{ slide.title }}
              </p>
            </div>

            <a
              v-if="slide.href"
              :href="slide.href"
              :aria-label="slide.title ?? slide.media.alt"
              :tabindex="index === activeIndex ? undefined : -1"
              class="focus-visible:ring-primary-comfy-yellow absolute inset-0 focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>
        </div>

        <div
          v-if="slides.length > 1"
          class="absolute right-4 bottom-4 flex gap-4 lg:right-10 lg:bottom-10"
        >
          <IconButton
            variant="ghost"
            size="lg"
            class="text-primary-warm-white rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
            :aria-label="prevLabel"
            @click="goTo(activeIndex - 1)"
          >
            <ChevronLeft class="size-7" />
          </IconButton>
          <IconButton
            variant="ghost"
            size="lg"
            class="text-primary-warm-white rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
            :aria-label="nextLabel"
            @click="goTo(activeIndex + 1)"
          >
            <ChevronRight class="size-7" />
          </IconButton>
        </div>
      </div>
    </div>
  </div>
</template>
