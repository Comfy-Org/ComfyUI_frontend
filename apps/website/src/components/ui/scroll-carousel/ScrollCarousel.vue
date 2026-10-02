<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  useElementHover,
  useIntersectionObserver,
  useScroll
} from '@vueuse/core'
import type { HTMLAttributes } from 'vue'
import { computed, ref } from 'vue'

import { useCarouselAutoplay } from '../../../composables/useCarouselAutoplay'
import { prefersReducedMotion } from '../../../composables/useReducedMotion'
import { t } from '../../../i18n/translations'
import type { Locale } from '../../../i18n/translations'

const {
  locale = 'en',
  gapClass = 'gap-12 lg:gap-20',
  autoplayMs,
  class: className
} = defineProps<{
  locale?: Locale
  gapClass?: string
  // Advances one viewport every `autoplayMs`, wrapping to the start; paused
  // while hovered, off-screen, or for reduced-motion visitors. Off by default.
  autoplayMs?: number
  class?: HTMLAttributes['class']
}>()

const trackRef = ref<HTMLElement>()
const { x } = useScroll(trackRef)

const progress = computed(() => {
  const el = trackRef.value
  if (!el) return 0
  const max = el.scrollWidth - el.clientWidth
  return max > 0 ? x.value / max : 0
})

function scroll(direction: -1 | 1) {
  const el = trackRef.value
  if (!el) return
  el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' })
}

function advance() {
  const el = trackRef.value
  if (!el) return
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
  if (atEnd) el.scrollTo({ left: 0, behavior: 'smooth' })
  else scroll(1)
}

const isVisible = ref(false)
useIntersectionObserver(trackRef, ([entry]) => {
  isVisible.value = entry?.isIntersecting ?? false
})
const isHovered = useElementHover(trackRef)

useCarouselAutoplay({
  delayMs: () => autoplayMs ?? 0,
  active: () =>
    Boolean(autoplayMs) &&
    !prefersReducedMotion() &&
    isVisible.value &&
    !isHovered.value,
  resetKey: x,
  advance
})

const progressPercent = computed(() => `${progress.value * 100}%`)
</script>

<template>
  <section
    :class="cn('mx-auto max-w-9xl px-6 py-16 lg:px-16 lg:py-24', className)"
  >
    <div
      ref="trackRef"
      data-testid="scroll-carousel-track"
      :class="
        cn(
          'scrollbar-none flex snap-x snap-mandatory overflow-x-auto',
          gapClass
        )
      "
    >
      <slot />
    </div>

    <div class="mt-10 flex items-center gap-4">
      <div class="h-1 flex-1 rounded-full bg-white/20" aria-hidden="true">
        <div
          class="h-full rounded-full bg-primary-comfy-yellow"
          :style="{ width: progressPercent }"
        />
      </div>

      <button
        type="button"
        class="flex size-10 items-center justify-center rounded-full border border-white/20 text-white/60 transition-colors hover:border-white/40"
        :aria-label="t('carousel.previous', locale)"
        @click="scroll(-1)"
      >
        <img
          src="/icons/arrow-right.svg"
          alt=""
          class="size-3 rotate-180 opacity-60 invert"
        />
      </button>

      <button
        type="button"
        class="flex size-10 items-center justify-center rounded-full bg-primary-comfy-yellow transition-opacity hover:opacity-90"
        :aria-label="t('carousel.next', locale)"
        @click="scroll(1)"
      >
        <img src="/icons/arrow-right.svg" alt="" class="size-3" />
      </button>
    </div>
  </section>
</template>
