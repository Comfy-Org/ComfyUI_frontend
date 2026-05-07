<template>
  <div
    ref="containerRef"
    class="relative flex size-full items-center justify-center overflow-hidden"
    :class="containerClass"
  >
    <template v-if="showVideo">
      <Skeleton
        v-if="!isVideoLoaded"
        width="100%"
        height="100%"
        class="absolute inset-0"
      />
      <video
        v-if="shouldLoad"
        data-testid="lazy-video"
        :src="src"
        :poster="frameUrl"
        :class="imageClass"
        :style="imageStyle"
        :aria-label="alt"
        autoplay
        loop
        muted
        playsinline
        @loadeddata="isVideoLoaded = true"
        @error="videoError = true"
      />
    </template>
    <LazyImage
      v-else
      :src="fallbackSrc"
      :alt="alt"
      :image-class="imageClass"
      :image-style="imageStyle"
      :root-margin="rootMargin"
    />
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import { computed, ref } from 'vue'
import type { StyleValue } from 'vue'

import LazyImage from '@/components/common/LazyImage.vue'
import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import {
  getVideoFrameUrl,
  isVideoSrc
} from '@/platform/workflow/templates/utils/hubAssetUrl'
import type { ClassValue } from '@/utils/tailwindUtil'

const {
  src,
  alt = '',
  containerClass = '',
  imageClass = '',
  imageStyle,
  rootMargin = '300px'
} = defineProps<{
  src: string
  alt?: string
  containerClass?: ClassValue
  imageClass?: ClassValue
  imageStyle?: StyleValue
  rootMargin?: string
}>()

const containerRef = ref<HTMLElement | null>(null)
const shouldLoad = ref(false)
const isVideoLoaded = ref(false)
const videoError = ref(false)

const isVideo = computed(() => isVideoSrc(src))
const frameUrl = computed(() => getVideoFrameUrl(src))
const showVideo = computed(() => isVideo.value && !videoError.value)
const fallbackSrc = computed(() => (isVideo.value ? frameUrl.value : src))

useIntersectionObserver(
  containerRef,
  (entries) => {
    shouldLoad.value = entries[0]?.isIntersecting ?? false
  },
  { rootMargin, threshold: 0.1 }
)
</script>
