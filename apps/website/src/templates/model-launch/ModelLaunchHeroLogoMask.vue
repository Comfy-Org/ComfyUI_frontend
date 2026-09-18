<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ref } from 'vue'

import { useHeroLogo } from '../../composables/useHeroLogo'

const { imageSrc, fallbackImageSrc } = defineProps<{
  imageSrc: string
  fallbackImageSrc?: string
}>()

const container = ref<HTMLElement>()
const { loaded } = useHeroLogo(container, {
  imageUrls: [imageSrc],
  bgScale: 0.55,
  fadeInDurationMs: 400
})
</script>

<template>
  <div
    ref="container"
    data-testid="model-launch-hero-logo-mask"
    class="relative h-64 w-full lg:h-80"
  >
    <img
      v-if="fallbackImageSrc"
      :src="fallbackImageSrc"
      alt=""
      aria-hidden="true"
      width="1440"
      height="810"
      :class="
        cn(
          'absolute inset-0 size-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-0' : 'opacity-100'
        )
      "
    />
  </div>
</template>
