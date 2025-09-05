<template>
  <div class="flex flex-col gap-1">
    <Galleria
      v-model:activeIndex="activeIndex"
      :value="galleryImages"
      v-bind="filteredProps"
      :disabled="readonly"
      :show-thumbnails="showThumbnails"
      :show-nav-buttons="showNavButtons"
      class="max-w-full"
      :pt="{
        thumbnails: {
          class: 'overflow-hidden'
        },
        thumbnailContent: {
          class: 'py-4 px-2'
        },
        thumbnailPrevButton: {
          class: 'm-0'
        },
        thumbnailNextButton: {
          class: 'm-0'
        }
      }"
    >
      <template #item="{ item }">
        <img
          :src="item.itemImageSrc || item.src || item"
          :alt="item.alt || 'Gallery image'"
          class="w-full h-auto max-h-64 object-contain"
        />
      </template>
      <template #thumbnail="{ item }">
        <div class="p-1 w-full h-full">
          <img
            :src="item.thumbnailImageSrc || item.src || item"
            :alt="item.alt || 'Gallery thumbnail'"
            class="w-full h-full object-cover rounded-lg"
          />
        </div>
      </template>
    </Galleria>
  </div>
</template>

<script setup lang="ts">
import Galleria from 'primevue/galleria'
import { computed, ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  GALLERIA_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

interface GalleryImage {
  itemImageSrc?: string
  thumbnailImageSrc?: string
  src?: string
  alt?: string
}

type GalleryValue = string[] | GalleryImage[]

const value = defineModel<GalleryValue>({ required: true })

const props = defineProps<{
  widget: SimplifiedWidget<GalleryValue>
  readonly?: boolean
}>()

const activeIndex = ref(0)

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, GALLERIA_EXCLUDED_PROPS)
)

const galleryImages = computed(() => {
  if (!value.value || !Array.isArray(value.value)) return []

  return value.value.map((item, index) => {
    if (typeof item === 'string') {
      return {
        itemImageSrc: item,
        thumbnailImageSrc: item,
        alt: `Image ${index + 1}`
      }
    }
    return item
  })
})

const showThumbnails = computed(() => {
  return (
    props.widget.options?.showThumbnails !== false &&
    galleryImages.value.length > 1
  )
})

const showNavButtons = computed(() => {
  return (
    props.widget.options?.showNavButtons !== false &&
    galleryImages.value.length > 1
  )
})
</script>

<style scoped>
/* Ensure thumbnail container doesn't overflow */
:deep(.p-galleria-thumbnails) {
  overflow: hidden;
}

/* Constrain thumbnail items to prevent overlap */
:deep(.p-galleria-thumbnail-item) {
  flex-shrink: 0;
}

/* Ensure thumbnail wrapper maintains aspect ratio */
:deep(.p-galleria-thumbnail) {
  overflow: hidden;
}
</style>
