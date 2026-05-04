<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const DEFAULT_BANNER = '/assets/images/fallback-gradient-avatar.svg'

const { bannerUrl, iconUrl, name } = defineProps<{
  bannerUrl?: string
  iconUrl?: string
  name: string
}>()

const hasError = ref(false)
const imgSrc = computed(() => bannerUrl || iconUrl || DEFAULT_BANNER)
const showFallback = computed(() => hasError.value || !imgSrc.value)
</script>

<template>
  <div
    class="z-0 aspect-7/3 w-full overflow-hidden"
    data-testid="cloud-node-pack-banner"
  >
    <div class="relative size-full">
      <div
        v-if="!showFallback"
        class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        :style="{ backgroundImage: `url(${imgSrc})`, filter: 'blur(10px)' }"
      />

      <img
        :src="showFallback ? DEFAULT_BANNER : imgSrc"
        :alt="`${name} banner`"
        :class="
          cn(
            'relative z-10 size-full',
            showFallback ? 'object-cover' : 'object-contain'
          )
        "
        @error="hasError = true"
      />
    </div>
  </div>
</template>
