<script setup lang="ts">
import SectionHeader from '@/components/common/SectionHeader.vue'
import Button from '@/components/ui/button/Button.vue'
import { externalLinks, getRoutes } from '@/config/routes'
import type { GalleryItem } from '@/data/gallery'
import { visibleGalleryItems } from '@/data/gallery'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import GalleryItemAttribution from '@/components/gallery/GalleryItemAttribution.vue'

const POSTS = 16

const { items = visibleGalleryItems, locale = 'en' } = defineProps<{
  items?: readonly GalleryItem[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

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
      <SectionHeader
        :label="t('workshop.explore.communityTitle')"
        heading-size="compact"
        max-width="md"
        align="start"
      >
        <span id="explore-community">
          {{ t('workshop.explore.communityHeading') }}
        </span>
        <template #subtitle>
          <p class="mt-2 text-sm text-content-secondary">
            {{ t('workshop.explore.communityBody') }}
          </p>
        </template>
      </SectionHeader>
      <div class="flex flex-wrap gap-2">
        <Button :href="gallery">
          {{ t('workshop.explore.communityExplore') }}
        </Button>
        <Button
          :href="externalLinks.gallerySubmit"
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
        >
          {{ t('workshop.explore.communityShare') }}
        </Button>
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
