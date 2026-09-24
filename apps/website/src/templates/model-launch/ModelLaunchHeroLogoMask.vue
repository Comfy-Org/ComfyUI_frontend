<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ref } from 'vue'

import {
  COMFY_LOGO_PATH,
  COMFY_LOGO_VIEWBOX,
  useHeroLogo
} from '../../composables/useHeroLogo'

const { imageSrc } = defineProps<{ imageSrc: string }>()

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
    class="relative flex h-64 w-full items-center justify-center lg:h-80"
  >
    <svg
      data-testid="model-launch-hero-logo-fallback"
      :viewBox="COMFY_LOGO_VIEWBOX"
      :class="
        cn(
          'h-3/7 w-auto transition-opacity duration-300',
          loaded ? 'opacity-0' : 'opacity-100'
        )
      "
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path :d="COMFY_LOGO_PATH" class="fill-primary-comfy-yellow" />
    </svg>
  </div>
</template>
