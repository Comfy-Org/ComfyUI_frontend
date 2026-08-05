<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { useIntersectionObserver } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { ModelLaunchGallery } from './types'

import Badge from '../../components/ui/badge/Badge.vue'
import IconButton from '../../components/ui/icon-button/IconButton.vue'
import { t } from '../../i18n/translations'

const { locale = 'en', gallery } = defineProps<{
  gallery: ModelLaunchGallery
  locale?: Locale
}>()

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
        {{ t(gallery.headingKey, locale) }}
      </h2>
    </div>

    <div
      class="mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2"
    >
      <article v-for="card in gallery.cards" :key="card.id">
        <div
          class="group rounded-4.5xl relative block aspect-19/10 overflow-hidden bg-black/40"
        >
          <video
            v-if="card.mediaSrc.endsWith('.webm')"
            :src="shouldLoadVideos ? card.mediaSrc : undefined"
            :aria-label="card.name[locale]"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            autoplay
            loop
            muted
            playsinline
            preload="none"
          />
          <img
            v-else
            :src="card.mediaSrc"
            :alt="card.name[locale]"
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
            <Badge :variant="card.tier === 'free' ? 'accent' : 'callout'">
              {{
                card.tier === 'free'
                  ? t('modelLaunch.tagFree', locale)
                  : t('modelLaunch.tagPremium', locale)
              }}
            </Badge>
            <span class="text-primary-warm-gray text-xs">
              {{ card.note[locale] }}
            </span>
          </div>

          <IconButton
            as="a"
            :href="card.href"
            target="_blank"
            rel="noopener"
            :aria-label="card.name[locale]"
            size="sm"
            class="bg-primary-warm-gray hover:bg-primary-comfy-yellow rounded-xl text-primary-comfy-ink hover:text-primary-comfy-ink"
          >
            <ChevronRight class="size-5" :stroke-width="2" />
          </IconButton>
        </div>

        <p class="mt-3 text-sm font-light text-primary-comfy-canvas">
          {{ card.description[locale] }}
        </p>
      </article>
    </div>
  </section>
</template>
