<script setup lang="ts">
import { useElementHover, useEventListener, useRafFn } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { WorkshopModel } from '../../config/models-catalogue'
import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { bannerName } from '../../lib/workshop/banner-name'
import { modelDocsHref } from '../../lib/workshop/model-docs'
import { taskLabelFor } from '../../lib/workshop/task-label'
import Badge from '../ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'

const AUTOPLAY_MS = 7000
const CAPABILITY_LIMIT = 3

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const slides = computed(() =>
  models.map((model) => {
    const task = taskLabelFor(model, locale)
    return {
      model,
      task,
      name: bannerName(model.name, task),
      capabilities: model.capabilities.slice(0, CAPABILITY_LIMIT)
    }
  })
)

const activeIndex = ref(0)
const active = computed(
  () => slides.value[Math.min(activeIndex.value, slides.value.length - 1)]
)

function goTo(index: number) {
  activeIndex.value = (index + slides.value.length) % slides.value.length
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
    slides.value.length > 1 &&
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
    <div
      class="group short:h-57 sm:short:h-60 relative block h-100"
      data-testid="featured-slide"
    >
      <a
        :href="active.model.href"
        :aria-label="active.name"
        class="absolute inset-0"
        data-testid="featured-slide-link"
      ></a>
      <video
        v-if="active.model.thumbnail?.kind === 'video'"
        :key="active.model.slug"
        :src="active.model.thumbnail.url"
        class="pointer-events-none absolute inset-0 size-full object-cover"
        aria-hidden="true"
        muted
        loop
        playsinline
        :autoplay="!prefersReducedMotion()"
        preload="auto"
        data-testid="featured-video"
      />
      <img
        v-else-if="active.model.thumbnailUrl"
        :key="active.model.slug"
        :src="active.model.thumbnailUrl"
        alt=""
        class="pointer-events-none absolute inset-0 size-full object-cover"
        decoding="async"
      />
      <div
        class="from-page via-page/85 to-page/20 sm:via-page/80 pointer-events-none absolute inset-0 bg-linear-to-t sm:bg-linear-to-r sm:to-transparent"
        aria-hidden="true"
      />

      <div
        class="short:gap-3 short:pt-5 short:pb-14 pointer-events-none relative flex h-full flex-col justify-end gap-4 p-8 pt-6 pb-16 max-sm:gap-3 max-sm:p-6 max-sm:pb-14 sm:max-w-2xl sm:justify-center lg:p-12 lg:pt-8 lg:pb-18"
      >
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="subtle" size="md" class="text-primary-comfy-canvas">
            {{ active.task }}
          </Badge>
          <Badge
            v-for="capability in active.capabilities"
            :key="capability"
            variant="subtle"
            size="md"
            class="text-content-secondary max-sm:hidden"
          >
            {{ capability }}
          </Badge>
        </div>

        <h2
          class="mt-2 text-2xl font-bold text-balance text-primary-warm-white lg:text-[2rem]"
        >
          {{ active.name }}
        </h2>

        <p
          v-if="active.model.summary"
          class="text-content-secondary short:hidden line-clamp-2 max-w-prose shrink-0"
        >
          {{ active.model.summary }}
        </p>

        <div class="pointer-events-auto flex w-fit items-center gap-3">
          <Button as="a" :href="active.model.href" class="w-fit">
            {{ t('workshop.hub.tryNow', locale) }}
          </Button>
          <Button
            v-if="modelDocsHref(active.model)"
            as="a"
            variant="outline"
            :href="modelDocsHref(active.model)"
            target="_blank"
            rel="noopener"
            class="w-fit"
            data-testid="featured-docs-link"
          >
            {{ t('workshop.hub.docs', locale) }}
          </Button>
        </div>
      </div>
    </div>

    <div
      v-if="slides.length > 1"
      class="absolute bottom-5 left-8 flex gap-2 lg:left-12"
      data-testid="featured-pagination"
    >
      <button
        v-for="(slide, index) in slides"
        :key="slide.model.slug"
        type="button"
        :aria-label="slide.model.name"
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
