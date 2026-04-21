<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { GalleryItem } from './GallerySection.vue'

const {
  item,
  locale = 'en',
  aspect = 'var(--aspect-ratio-gallery-card)',
  mobile = false
} = defineProps<{
  item: GalleryItem
  locale?: Locale
  aspect?: string
  mobile?: boolean
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
        class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <img
        v-else
        :src="item.image"
        :alt="item.title"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <!-- Desktop hover overlay -->
      <div
        v-if="!mobile"
        class="absolute inset-0 flex items-end bg-linear-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      >
        <div class="flex w-full items-end justify-between p-4">
          <div class="gap-2">
            <p class="text-sm font-bold text-white">{{ item.title }}</p>
            <p class="text-primary-comfy-canvas text-xs">
              {{ t('gallery.card.by', locale) }}
              <span class="text-primary-comfy-yellow">{{
                item.userAlias
              }}</span>
              <template v-if="item.teamAlias">
                {{ t('gallery.card.and', locale) }}
                <span class="text-primary-comfy-yellow">{{
                  item.teamAlias
                }}</span>
                {{ t('gallery.card.teamUsing', locale) }}
              </template>
              <template v-else> using </template>
              <span class="text-primary-comfy-yellow">{{ item.tool }}</span>
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
      <p class="text-primary-comfy-canvas text-xs">
        {{ t('gallery.card.by', locale) }}
        <span class="text-primary-comfy-yellow">{{ item.userAlias }}</span>
        <template v-if="item.teamAlias">
          {{ t('gallery.card.and', locale) }}
          <span class="text-primary-comfy-yellow">{{ item.teamAlias }}</span>
          {{ t('gallery.card.teamUsing', locale) }}
        </template>
        <template v-else> using </template>
        <span class="text-primary-comfy-yellow">{{ item.tool }}</span>
      </p>
    </div>
  </div>
</template>
