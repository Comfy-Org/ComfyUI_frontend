<script setup lang="ts">
import { useElementHover, useEventListener, useRafFn } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import Badge from '../ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'

/** One thing worth opening, whatever kind of thing the catalogue holds. */
export interface FeaturedSlide {
  readonly key: string
  readonly href: string
  readonly title: string
  /** What it is or what it makes, in the badge that leads the slide. */
  readonly kind: string
  readonly tags: readonly string[]
  readonly summary?: string
  readonly thumbnailUrl?: string
}

const AUTOPLAY_MS = 7000

const { slides, locale = 'en' } = defineProps<{
  slides: readonly FeaturedSlide[]
  locale?: Locale
}>()

const activeIndex = ref(0)
const active = computed(
  () => slides[Math.min(activeIndex.value, slides.length - 1)]
)

function goTo(index: number) {
  activeIndex.value = (index + slides.length) % slides.length
}

const banner = useTemplateRef<HTMLElement>('banner')
const hovered = useElementHover(banner)

// Clicking a bar leaves it focused, so pausing on any focus would stop the
// rotation for good. Only a keyboard visitor, who needs the time, stops it.
const readingByKeyboard = ref(false)
const trackKeyboardFocus = () => {
  readingByKeyboard.value =
    banner.value?.querySelector(':focus-visible') != null
}
useEventListener(banner, 'focusin', trackKeyboardFocus)
useEventListener(banner, 'focusout', () => (readingByKeyboard.value = false))

const rotating = computed(
  () =>
    slides.length > 1 &&
    !hovered.value &&
    !readingByKeyboard.value &&
    !prefersReducedMotion()
)

// The bar is the timer: it fills over the slide's turn and freezes where it
// stands while the visitor reads, rather than animating on its own clock.
const elapsed = ref(0)
const { pause, resume } = useRafFn(
  ({ delta }) => {
    elapsed.value += delta
    if (elapsed.value >= AUTOPLAY_MS) goTo(activeIndex.value + 1)
  },
  { immediate: false }
)

watch(rotating, (on) => (on ? resume() : pause()), { immediate: true })
watch(activeIndex, () => (elapsed.value = 0))

const fill = computed(() =>
  prefersReducedMotion() ? 1 : Math.min(elapsed.value / AUTOPLAY_MS, 1)
)
</script>

<template>
  <section
    v-if="active"
    ref="banner"
    :aria-label="t('workshop.sections.featured', locale)"
    class="rounded-4.5xl relative isolate overflow-hidden border border-transparency-white-t8"
    data-testid="section-featured"
  >
    <a
      :href="active.href"
      class="group short:h-76 sm:short:h-76 block h-112"
      data-testid="featured-slide"
    >
      <img
        v-if="active.thumbnailUrl"
        :key="active.key"
        :src="active.thumbnailUrl"
        alt=""
        class="absolute inset-0 size-full object-cover"
        decoding="async"
      />
      <div
        class="from-page via-page/85 to-page/20 sm:via-page/80 absolute inset-0 bg-linear-to-t sm:bg-linear-to-r sm:to-transparent"
        aria-hidden="true"
      />

      <div
        class="sm:short:pb-16 lg:short:p-8 lg:short:pb-16 sm:short:gap-3 relative flex h-full flex-col justify-end gap-4 p-8 pb-20 max-sm:gap-3 max-sm:p-6 max-sm:pb-14 sm:max-w-2xl sm:justify-center lg:p-12 lg:pb-20"
      >
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="subtle" size="md" class="text-primary-comfy-canvas">
            {{ active.kind }}
          </Badge>
          <Badge
            v-for="tag in active.tags"
            :key="tag"
            variant="subtle"
            size="md"
            class="text-content-secondary max-sm:hidden"
          >
            {{ tag }}
          </Badge>
        </div>

        <h2
          class="lg:short:text-4xl text-4xl font-bold text-primary-warm-white lg:text-5xl"
        >
          {{ active.title }}
        </h2>

        <p
          v-if="active.summary"
          class="text-content-secondary line-clamp-2 max-w-prose"
        >
          {{ active.summary }}
        </p>

        <Button as="span" class="w-fit">
          {{ t('workshop.hub.tryNow', locale) }}
        </Button>
      </div>
    </a>

    <div
      v-if="slides.length > 1"
      class="absolute bottom-5 left-8 flex gap-2 lg:left-12"
      data-testid="featured-pagination"
    >
      <button
        v-for="(slide, index) in slides"
        :key="slide.key"
        type="button"
        :aria-label="slide.title"
        :aria-current="index === activeIndex ? 'true' : undefined"
        class="focus-visible:ring-primary-comfy-yellow/50 group w-12 cursor-pointer rounded-full py-3 outline-none focus-visible:ring-3"
        @click="goTo(index)"
      >
        <span
          class="block h-1 overflow-hidden rounded-full bg-transparency-white-t20 group-hover:bg-primary-warm-gray"
        >
          <span
            class="block h-full rounded-full bg-primary-warm-white"
            :style="{
              width: index === activeIndex ? `${fill * 100}%` : '0%'
            }"
          />
        </span>
      </button>
    </div>
  </section>
</template>
