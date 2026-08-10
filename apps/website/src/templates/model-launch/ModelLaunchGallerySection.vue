<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronRight } from '@lucide/vue'
import { useIntersectionObserver } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { ModelLaunchGallery } from './types'

import Badge from '../../components/ui/badge/Badge.vue'
import CopyTextButton from '../../components/ui/copy-text-button/CopyTextButton.vue'
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
            v-if="card.media.kind === 'video'"
            :src="shouldLoadVideos ? card.media.src : undefined"
            :poster="card.media.posterSrc"
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
            :src="card.media.src"
            :alt="card.name[locale]"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />

          <div
            class="absolute inset-0 bg-linear-to-b from-black/25 to-transparent"
          />

          <div
            v-if="card.logoSrc"
            aria-hidden="true"
            class="absolute inset-x-8 top-8 flex items-start justify-end"
          >
            <div
              class="group-hover:bg-primary-comfy-yellow flex size-10 items-center justify-center rounded-2xl bg-transparency-white-t20 text-primary-warm-white backdrop-blur-sm transition-colors group-hover:text-primary-comfy-ink"
            >
              <span
                class="inline-block size-6 bg-current"
                :style="{
                  maskImage: `url(${card.logoSrc})`,
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center'
                }"
              />
            </div>
          </div>
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
            <span class="text-xs text-primary-warm-gray">
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
            :class="
              cn(
                'rounded-xl text-primary-comfy-ink hover:text-primary-comfy-ink',
                gallery.ctaVariant === 'accent'
                  ? 'bg-primary-comfy-yellow hover:opacity-90'
                  : 'hover:bg-primary-comfy-yellow bg-primary-warm-gray'
              )
            "
          >
            <ChevronRight class="size-5" :stroke-width="2" />
          </IconButton>
        </div>

        <p class="mt-3 text-sm font-light text-primary-comfy-canvas">
          {{ card.description[locale] }}
        </p>

        <div
          v-if="card.prompt"
          class="mt-4 flex items-end gap-2 rounded-2xl border border-transparency-white-t8 p-6"
        >
          <p
            class="line-clamp-5 flex-1 text-sm/relaxed font-light whitespace-pre-line text-primary-warm-gray"
          >
            {{ card.prompt[locale] }}
          </p>
          <CopyTextButton
            class="-mr-2 -mb-2"
            :value="card.prompt[locale]"
            :label="t('modelLaunch.copyPrompt', locale)"
            :copied-label="t('ui.copied', locale)"
          />
        </div>
      </article>
    </div>
  </section>
</template>
