<script setup lang="ts">
import { externalLinks, getRoutes } from '../../config/routes'
import type { GalleryItem } from '../../data/gallery'
import { visibleGalleryItems } from '../../data/gallery'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import GalleryItemAttribution from '../gallery/GalleryItemAttribution.vue'

const POSTS = 16

const { items = visibleGalleryItems, locale = 'en' } = defineProps<{
  items?: readonly GalleryItem[]
  locale?: Locale
}>()

const gallery = getRoutes(locale).gallery
const posts = items.slice(0, POSTS)
</script>

<template>
  <section
    v-if="posts.length"
    aria-labelledby="explore-community"
    data-testid="explore-community"
  >
    <div
      class="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 rounded-3xl bg-hub-surface p-6 lg:p-8"
    >
      <div class="flex max-w-xl flex-col gap-2">
        <p class="text-sm font-medium text-primary-comfy-yellow">
          {{ t('workshop.explore.communityTitle', locale) }}
        </p>
        <h2
          id="explore-community"
          class="text-3xl/tight font-light text-primary-warm-white"
        >
          {{ t('workshop.explore.communityHeading', locale) }}
        </h2>
        <p class="text-sm text-content-secondary">
          {{ t('workshop.explore.communityBody', locale) }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <a
          :href="gallery"
          class="rounded-xl bg-primary-comfy-yellow px-4 py-2 text-sm font-medium text-primary-comfy-ink outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        >
          {{ t('workshop.explore.communityExplore', locale) }}
        </a>
        <a
          :href="externalLinks.gallerySubmit"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-xl border border-transparency-white-t20 px-4 py-2 text-sm font-medium text-primary-warm-white outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        >
          {{ t('workshop.explore.communityShare', locale) }}
        </a>
      </div>
    </div>
    <div class="columns-2 gap-4 md:columns-3 xl:columns-4">
      <a
        v-for="post in posts"
        :key="post.id"
        :href="gallery"
        class="group relative mb-4 block break-inside-avoid overflow-hidden rounded-2xl bg-hub-surface outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="explore-community-post"
      >
        <video
          v-if="post.video"
          :src="post.video"
          class="block h-auto w-full transition-transform duration-500 group-hover:scale-105"
          aria-hidden="true"
          autoplay
          loop
          muted
          playsinline
          preload="metadata"
        />
        <img
          v-else
          :src="post.image"
          alt=""
          class="block h-auto w-full transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
        <span
          class="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-linear-to-t from-black/80 to-transparent p-3 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span class="text-sm font-medium text-white">{{ post.title }}</span>
          <span class="text-xs text-primary-comfy-canvas">
            <GalleryItemAttribution :item="post" :locale />
          </span>
        </span>
      </a>
    </div>
  </section>
</template>
