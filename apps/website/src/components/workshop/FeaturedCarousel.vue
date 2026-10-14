<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, useTemplateRef } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useSlideRotation } from '@/composables/useSlideRotation'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogueFeature } from '@/lib/workshop/catalogue-features'
import WorkshopCardMaker from './WorkshopCardMaker.vue'
import WorkshopCardMedia from './WorkshopCardMedia.vue'

const AUTOPLAY_MS = 6000

const {
  features,
  label,
  locale = 'en'
} = defineProps<{
  features: readonly CatalogueFeature[]
  label: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const root = useTemplateRef<HTMLElement>('root')
const { shownIndex, goTo, fill, rotating } = useSlideRotation({
  root,
  count: () => features.length,
  intervalMs: AUTOPLAY_MS
})
const active = computed<CatalogueFeature | undefined>(
  () => features[shownIndex.value]
)

function barFill(index: number) {
  if (index < shownIndex.value) return 1
  return index === shownIndex.value ? fill.value : 0
}
</script>

<template>
  <section
    v-if="active"
    ref="root"
    :aria-label="label"
    :aria-roledescription="t('auth.hero.carouselRoleDescription')"
    class="group relative isolate flex min-h-100 flex-col overflow-hidden rounded-3xl bg-hub-surface xl:h-110"
    data-testid="featured-carousel"
  >
    <Transition
      enter-from-class="opacity-0"
      enter-active-class="transition-opacity duration-500 motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-500 motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
      <div
        :key="active.key"
        class="absolute inset-0 -z-10 *:object-[50%_35%]"
        data-testid="featured-media"
      >
        <WorkshopCardMedia :model="active.media" />
      </div>
    </Transition>
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-black/75 via-black/40 via-50% to-black/0 to-85% sm:via-30% sm:to-55%"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-primary-comfy-ink/85 via-primary-comfy-ink/60 via-50% to-primary-comfy-ink/25"
      aria-hidden="true"
    />

    <div
      v-if="features.length > 1"
      class="absolute top-4 right-4 z-10 flex gap-2 sm:top-6 sm:right-6"
      data-testid="featured-thumbs"
    >
      <button
        v-for="(feature, index) in features"
        :key="feature.key"
        type="button"
        :aria-label="feature.title"
        :aria-pressed="index === shownIndex"
        :class="
          cn(
            'grid size-10 cursor-pointer place-items-center overflow-hidden rounded-lg border-2 bg-hub-surface-hover text-sm font-semibold text-primary-warm-white transition-[border-color,opacity] outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
            index === shownIndex
              ? 'border-primary-warm-white'
              : 'border-transparent opacity-80 hover:opacity-100'
          )
        "
        @click="goTo(index)"
      >
        <img
          v-if="feature.still"
          :src="feature.still"
          alt=""
          class="size-full object-cover"
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <video
          v-else-if="feature.media.thumbnail?.kind === 'video'"
          :src="`${feature.media.thumbnail.url}#t=0.1`"
          class="size-full object-cover"
          aria-hidden="true"
          muted
          playsinline
          preload="metadata"
          data-testid="featured-thumb-video"
        />
        <span v-else aria-hidden="true">{{ feature.title[0] }}</span>
      </button>
    </div>

    <div
      :key="active.key"
      role="group"
      :aria-roledescription="t('auth.hero.slideRoleDescription')"
      :aria-label="
        t('auth.hero.slideStatus', {
          title: active.title,
          current: shownIndex + 1,
          total: features.length
        })
      "
      :aria-live="rotating ? 'off' : 'polite'"
      class="relative flex flex-1 flex-col justify-end gap-3 px-5 pt-20 pb-12 sm:px-8 sm:pb-16 xl:justify-center xl:pt-16"
      data-testid="featured-slide"
    >
      <div class="flex min-w-0 items-center gap-3">
        <span
          class="shrink-0 rounded-md bg-primary-comfy-yellow px-2 py-1 text-xs/none font-bold tracking-wide text-primary-comfy-ink uppercase"
          data-testid="featured-badge"
        >
          {{ active.badge }}
        </span>
        <WorkshopCardMaker
          :label="active.source.label"
          :logo="active.source.logo"
          class="text-sm font-medium text-primary-warm-white"
        />
      </div>
      <h2
        class="text-3xl/tight font-semibold text-balance text-primary-warm-white text-shadow-lg text-shadow-primary-comfy-ink/60 lg:text-4xl/tight"
      >
        <a
          :href="active.href"
          class="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          data-testid="featured-title"
        >
          {{ active.title }}
        </a>
      </h2>
      <p
        v-if="active.summary"
        class="line-clamp-2 text-base font-light text-content-secondary text-shadow-lg text-shadow-primary-comfy-ink/60 sm:line-clamp-1"
      >
        {{ active.summary }}
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button
          :href="active.href"
          :append-icon="ArrowRight"
          :aria-label="active.ctaLabel"
          class="h-11 rounded-full px-6"
          data-testid="featured-cta"
        >
          {{ active.cta }}
        </Button>
        <p
          v-if="active.price"
          class="text-sm font-medium text-primary-comfy-canvas text-shadow-lg text-shadow-primary-comfy-ink/60"
          data-testid="featured-price"
        >
          {{ active.price }}
        </p>
      </div>
    </div>

    <div
      v-if="features.length > 1"
      class="pointer-events-none absolute inset-x-5 bottom-6 flex gap-2 sm:inset-x-8"
      aria-hidden="true"
      data-testid="featured-progress"
    >
      <span
        v-for="(feature, index) in features"
        :key="feature.key"
        class="h-0.5 flex-1 overflow-hidden rounded-full bg-primary-warm-white/25"
      >
        <span
          class="block h-full rounded-full bg-primary-warm-white"
          :style="{ width: `${barFill(index) * 100}%` }"
        />
      </span>
    </div>
  </section>
</template>
