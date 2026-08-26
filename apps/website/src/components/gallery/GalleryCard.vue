<script setup lang="ts">
import type { GalleryItem } from '../../data/gallery'
import type { Locale } from '../../i18n/translations'
import GalleryItemAttribution from './GalleryItemAttribution.vue'

const {
  item,
  locale = 'en',
  aspect = 'var(--aspect-ratio-gallery-card)',
  mobile = false,
  objectPosition = 'center',
  objectFit = 'cover'
} = defineProps<{
  item: GalleryItem
  locale?: Locale
  aspect?: string
  mobile?: boolean
  objectPosition?: string
  objectFit?: string
}>()

defineEmits<{ click: [] }>()
</script>

<template>
  <div class="group block cursor-pointer" @click="$emit('click')">
    <div
      class="rounded-4.5xl relative overflow-hidden"
      :style="{ aspectRatio: aspect }"
    >
      <video
        v-if="item.video"
        :src="item.video"
        autoplay
        loop
        muted
        playsinline
        class="size-full transition-transform duration-300 group-hover:scale-105"
        :style="{ objectPosition, objectFit }"
      />
      <img
        v-else
        :src="item.image"
        :alt="item.title"
        loading="lazy"
        decoding="async"
        class="size-full transition-transform duration-300 group-hover:scale-105"
        :style="{ objectPosition, objectFit }"
      />
      <!-- Desktop hover overlay -->
      <div
        v-if="!mobile"
        class="absolute inset-0 flex items-end bg-linear-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      >
        <div class="flex w-full items-end justify-between p-4">
          <div class="gap-2">
            <p class="text-sm font-bold text-white">{{ item.title }}</p>
            <p class="text-xs text-primary-comfy-canvas">
              <GalleryItemAttribution :item :locale />
            </p>
          </div>
          <span
            class="bg-primary-comfy-yellow flex size-8 shrink-0 items-center justify-center rounded-full"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              class="text-primary-comfy-ink"
            >
              <path
                d="M1 7h12m0 0L8 2m5 5L8 12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </div>
    <!-- Mobile metadata -->
    <div v-if="mobile" class="mt-2 gap-2">
      <p class="text-sm font-bold text-white">{{ item.title }}</p>
      <p class="text-xs text-primary-comfy-canvas">
        <GalleryItemAttribution :item :locale />
      </p>
    </div>
  </div>
</template>
