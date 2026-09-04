<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import PlayOverlay from '../blocks/PlayOverlay.vue'

const { story, locale = 'en' } = defineProps<{
  story: {
    slug: string
    company: string
    category: string
    title: string
    description: string
    poster: string
    posterWidth: number
    posterHeight: number
    /** "4:32", or undefined when the duration hasn't been verified yet. */
    duration?: string
  }
  locale?: Locale
}>()
</script>

<template>
  <a
    :href="`/customers/videos/${story.slug}`"
    class="bg-transparency-white-t4 group flex flex-col overflow-hidden rounded-3xl transition-colors hover:bg-white/8"
  >
    <div class="group relative m-2 aspect-video overflow-hidden rounded-2xl">
      <img
        :src="story.poster"
        :width="story.posterWidth"
        :height="story.posterHeight"
        :alt="`${story.company}: ${story.title}`"
        loading="lazy"
        decoding="async"
        class="size-full object-cover"
      />
      <PlayOverlay />
      <span
        v-if="story.duration"
        class="absolute right-2 bottom-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs text-primary-warm-white"
      >
        {{ story.duration }}
      </span>
    </div>

    <div class="flex flex-1 flex-col justify-between px-6 pt-4 pb-6">
      <div>
        <span
          class="text-primary-comfy-yellow text-[10px] font-semibold tracking-widest uppercase"
        >
          {{ story.company }} · {{ story.category }}
        </span>
        <h3
          class="mt-2 text-lg/snug font-light text-primary-comfy-canvas lg:text-xl/snug"
        >
          {{ story.title }}
        </h3>
        <p class="mt-2 line-clamp-2 text-sm font-light text-primary-warm-gray">
          {{ story.description }}
        </p>
      </div>

      <div
        class="mt-8 flex items-center gap-3 text-xs font-semibold tracking-widest uppercase"
      >
        <span
          class="bg-primary-comfy-yellow flex size-8 items-center justify-center rounded-full"
        >
          <img src="/icons/arrow-right.svg" alt="" class="ml-0.5 size-3" />
        </span>
        <span class="text-primary-comfy-canvas">
          {{ t('customers.video.watchStory', locale) }}
        </span>
      </div>
    </div>
  </a>
</template>
