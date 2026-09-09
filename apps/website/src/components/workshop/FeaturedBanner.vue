<script setup lang="ts">
import { useElementHover, useFocusWithin } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '../../config/models-catalogue'
import { useCarouselAutoplay } from '../../composables/useCarouselAutoplay'
import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
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
  models.map((model) => ({
    model,
    task: taskLabelFor(model, locale),
    capabilities: model.capabilities.slice(0, CAPABILITY_LIMIT)
  }))
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
const { focused } = useFocusWithin(banner)

useCarouselAutoplay({
  delayMs: AUTOPLAY_MS,
  active: () =>
    slides.value.length > 1 &&
    !hovered.value &&
    !focused.value &&
    !prefersReducedMotion(),
  resetKey: activeIndex,
  advance: () => goTo(activeIndex.value + 1)
})
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
      :href="active.model.href"
      class="group block h-112"
      data-testid="featured-slide"
    >
      <img
        v-if="active.model.thumbnailUrl"
        :key="active.model.slug"
        :src="active.model.thumbnailUrl"
        alt=""
        class="absolute inset-0 size-full object-cover"
        decoding="async"
      />
      <div
        class="from-page via-page/85 to-page/20 sm:via-page/80 absolute inset-0 bg-linear-to-t sm:bg-linear-to-r sm:to-transparent"
        aria-hidden="true"
      />

      <div
        class="relative flex h-full flex-col justify-end gap-4 p-8 pb-20 sm:max-w-2xl sm:justify-center lg:p-12 lg:pb-20"
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

        <h2 class="text-4xl font-bold text-primary-warm-white lg:text-5xl">
          {{ active.model.name }}
        </h2>

        <p
          v-if="active.model.summary"
          class="text-content-secondary line-clamp-3 max-w-prose"
        >
          {{ active.model.summary }}
        </p>

        <Button as="span" class="w-fit">
          {{ t('workshop.hub.tryNow', locale) }}
        </Button>
      </div>
    </a>

    <div
      v-if="slides.length > 1"
      class="absolute bottom-8 left-8 flex gap-2 lg:left-12"
      data-testid="featured-pagination"
    >
      <button
        v-for="(slide, index) in slides"
        :key="slide.model.slug"
        type="button"
        :aria-label="slide.model.name"
        :aria-current="index === activeIndex ? 'true' : undefined"
        :class="
          cn(
            'focus-visible:ring-primary-comfy-yellow/50 h-1 w-12 cursor-pointer rounded-full transition-colors outline-none focus-visible:ring-3',
            index === activeIndex
              ? 'bg-primary-warm-white'
              : 'bg-transparency-white-t20 hover:bg-primary-warm-gray'
          )
        "
        @click="goTo(index)"
      />
    </div>
  </section>
</template>
