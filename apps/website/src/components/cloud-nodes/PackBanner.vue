<script setup lang="ts">
import { useBannerImage } from '../../composables/useBannerImage'

const { bannerUrl, iconUrl, name } = defineProps<{
  bannerUrl?: string
  iconUrl?: string
  name: string
}>()

const {
  DEFAULT_BANNER,
  isImageError,
  showDefaultBanner,
  imgSrc,
  onImageError
} = useBannerImage({
  bannerUrl: () => bannerUrl,
  iconUrl: () => iconUrl
})
</script>

<template>
  <div
    class="z-0 aspect-7/3 w-full overflow-hidden"
    data-testid="cloud-node-pack-banner"
  >
    <div v-if="showDefaultBanner" class="size-full">
      <img
        :src="DEFAULT_BANNER"
        :alt="`${name} banner`"
        class="size-full object-cover"
      />
    </div>
    <div v-else class="relative size-full">
      <div
        v-if="imgSrc && !isImageError"
        class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        :style="{ backgroundImage: `url(${imgSrc})`, filter: 'blur(10px)' }"
      />
      <img
        :src="isImageError ? DEFAULT_BANNER : imgSrc"
        :alt="`${name} banner`"
        :class="
          isImageError
            ? 'relative z-10 size-full object-cover'
            : 'relative z-10 size-full object-contain'
        "
        @error="onImageError"
      />
    </div>
  </div>
</template>
