<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { GalleryItem } from './GallerySection.vue'

const {
  item,
  locale = 'en',
  hero = false,
  mobile = false
} = defineProps<{
  item: GalleryItem
  locale?: Locale
  hero?: boolean
  mobile?: boolean
}>()

defineEmits<{ click: [] }>()
</script>

<template>
  <div class="group block cursor-pointer" @click="$emit('click')">
    <div
      class="relative overflow-hidden rounded-2xl"
      :class="hero ? 'aspect-21/9' : mobile ? 'aspect-4/3' : 'aspect-3/2'"
    >
      <img
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
              {{ t('gallery.card.and', locale) }}
              <span class="text-primary-comfy-yellow">{{
                item.teamAlias
              }}</span>
              {{ t('gallery.card.teamUsing', locale) }}
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
        {{ t('gallery.card.and', locale) }}
        <span class="text-primary-comfy-yellow">{{ item.teamAlias }}</span>
        {{ t('gallery.card.teamUsing', locale) }}
        <span class="text-primary-comfy-yellow">{{ item.tool }}</span>
      </p>
    </div>
  </div>
</template>
