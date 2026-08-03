<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { useIntersectionObserver } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'

import type { Locale } from '../../i18n/translations'

import Badge from '../../components/ui/badge/Badge.vue'
import { minimaxModels } from '../../data/minimax'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// The cards sit well below the fold; defer their videos until the section
// nears the viewport instead of fetching all of them during first paint.
const sectionRef = useTemplateRef<HTMLElement>('sectionRef')
const shouldLoadVideos = ref(false)
const { stop } = useIntersectionObserver(
  sectionRef,
  ([entry]) => {
    if (!entry?.isIntersecting) return
    shouldLoadVideos.value = true
    stop()
  },
  { rootMargin: '200px' }
)
</script>

<template>
  <section
    ref="sectionRef"
    class="max-w-9xl mx-auto px-4 py-16 lg:px-20 lg:py-24"
  >
    <div class="mx-auto flex max-w-3xl flex-col items-center text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t('minimax.models.heading', locale) }}
      </h2>
    </div>

    <div
      class="mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2"
    >
      <article
        v-for="model in minimaxModels"
        :key="model.id"
        class="group/card relative"
      >
        <div
          class="group rounded-4.5xl relative block aspect-19/10 overflow-hidden bg-black/40"
        >
          <video
            v-if="model.mediaSrc.endsWith('.webm')"
            :src="shouldLoadVideos ? model.mediaSrc : undefined"
            :aria-label="model.name[locale]"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            autoplay
            loop
            muted
            playsinline
            preload="none"
          />
          <img
            v-else
            :src="model.mediaSrc"
            :alt="model.name[locale]"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />

          <div
            class="absolute inset-0 bg-linear-to-b from-black/25 to-transparent"
          />
        </div>

        <div class="mt-5 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <Badge :variant="model.tier === 'free' ? 'accent' : 'callout'">
              {{
                model.tier === 'free'
                  ? t('minimax.models.tagFree', locale)
                  : t('minimax.models.tagPremium', locale)
              }}
            </Badge>
            <span class="text-primary-warm-gray text-xs">
              {{ model.note[locale] }}
            </span>
          </div>

          <a
            :href="model.href"
            target="_blank"
            rel="noopener"
            :aria-label="model.name[locale]"
            class="group/workflow-cta bg-primary-warm-gray hover:bg-primary-comfy-yellow md:group-hover/card:bg-primary-comfy-yellow inline-flex h-8 shrink-0 cursor-pointer items-center overflow-hidden rounded-xl text-sm font-bold tracking-wider text-primary-comfy-ink uppercase transition-all duration-500 after:absolute after:inset-0"
          >
            <span class="flex size-8 items-center justify-center">
              <ChevronRight class="size-5" :stroke-width="2" />
            </span>
            <span
              class="grid grid-cols-[0fr] transition-[grid-template-columns] duration-500 md:group-hover/card:grid-cols-[1fr] md:group-hover/workflow-cta:grid-cols-[1fr]"
            >
              <span
                class="flex h-8 items-center overflow-hidden whitespace-nowrap transition-[padding] duration-500 md:group-hover/card:pe-3 md:group-hover/workflow-cta:pe-3"
              >
                <span class="ppformula-text-center leading-none">
                  {{ t('minimax.models.cardCta', locale) }}
                </span>
              </span>
            </span>
          </a>
        </div>

        <p class="mt-3 text-sm font-light text-primary-comfy-canvas">
          {{ model.description[locale] }}
        </p>
      </article>
    </div>
  </section>
</template>
