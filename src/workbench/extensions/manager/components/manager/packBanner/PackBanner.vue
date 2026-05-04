<template>
  <div class="z-0 aspect-7/3 w-full overflow-hidden">
    <!-- default banner show -->
    <div v-if="showDefaultBanner" class="size-full">
      <img
        :src="DEFAULT_BANNER"
        :alt="$t('g.defaultBanner')"
        class="size-full object-cover"
      />
    </div>
    <!-- banner_url or icon show -->
    <div v-else class="relative size-full">
      <!-- blur background -->
      <div
        v-if="imgSrc && !isImageError"
        class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        :style="{
          backgroundImage: `url(${imgSrc})`,
          filter: 'blur(10px)'
        }"
      ></div>
      <!-- image -->
      <img
        v-if="isImageError"
        :src="DEFAULT_BANNER"
        :alt="bannerAlt"
        class="relative z-10 size-full object-cover"
      />
      <img
        v-else
        :src="imgSrc"
        :alt="bannerAlt"
        class="relative z-10 size-full object-contain"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'

const DEFAULT_BANNER = '/assets/images/fallback-gradient-avatar.svg'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const showDefaultBanner = computed(() => !nodePack.banner_url && !nodePack.icon)
const imgSrc = computed(() => nodePack.banner_url || nodePack.icon || '')
const bannerAlt = computed(() => `${nodePack.name} banner`)

const { error: isImageError } = useImage(
  computed(() => ({ src: imgSrc.value, alt: bannerAlt.value }))
)
</script>
