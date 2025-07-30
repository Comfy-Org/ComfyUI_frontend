<template>
  <div
    ref="containerRef"
    class="relative overflow-hidden w-full h-full flex items-center justify-center"
  >
    <Skeleton
      v-if="!isImageLoaded"
      width="100%"
      height="100%"
      class="absolute inset-0"
    />
    <img
      v-show="isImageLoaded"
      ref="imageRef"
      :src="cachedSrc"
      :alt="alt"
      draggable="false"
      :class="imageClass"
      :style="imageStyle"
      @load="onImageLoad"
      @error="onImageError"
    />
    <div
      v-if="hasError"
      class="absolute inset-0 flex items-center justify-center bg-surface-50 dark-theme:bg-surface-800 text-muted"
    >
      <i class="pi pi-image text-2xl" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import { computed, ref, watch } from 'vue'

import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import { useMediaCache } from '@/services/mediaCacheService'

const {
  src,
  alt = '',
  imageClass = '',
  imageStyle,
  rootMargin = '50px'
} = defineProps<{
  src: string
  alt?: string
  imageClass?: string | string[] | Record<string, boolean>
  imageStyle?: Record<string, any>
  rootMargin?: string
}>()

const containerRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const isIntersecting = ref(false)
const isImageLoaded = ref(false)
const hasError = ref(false)
const cachedSrc = ref<string | undefined>(undefined)

const { getCachedMedia } = useMediaCache()

// Use intersection observer to detect when the image container comes into view
useIntersectionObserver(
  containerRef,
  (entries) => {
    const entry = entries[0]
    if (entry?.isIntersecting) {
      isIntersecting.value = true
    }
  },
  {
    rootMargin,
    threshold: 0.1
  }
)

// Only start loading the image when it's in view
const shouldLoad = computed(() => isIntersecting.value)

// Watch for when we should load and handle caching
watch(
  shouldLoad,
  async (shouldLoad) => {
    if (shouldLoad && src && !cachedSrc.value && !hasError.value) {
      try {
        const cachedMedia = await getCachedMedia(src)
        if (cachedMedia.error) {
          hasError.value = true
        } else if (cachedMedia.objectUrl) {
          cachedSrc.value = cachedMedia.objectUrl
        } else {
          cachedSrc.value = src
        }
      } catch (error) {
        console.warn('Failed to load cached media:', error)
        // Fallback to original src
        cachedSrc.value = src
      }
    }
  },
  { immediate: true }
)

const onImageLoad = () => {
  isImageLoaded.value = true
  hasError.value = false
}

const onImageError = () => {
  hasError.value = true
  isImageLoaded.value = false
}
</script>
