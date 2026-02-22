<template>
  <div class="aspect-7/3 w-full overflow-hidden z-0">
    <!-- default banner show -->
    <div v-if="showDefaultBanner" class="h-full w-full">
      <img
        :src="DEFAULT_BANNER"
        :alt="$t('g.defaultBanner')"
        class="h-full w-full object-cover"
      />
    </div>
    <!-- banner_url or icon show -->
    <div v-else class="relative h-full w-full">
      <!-- blur background -->
      <div
        v-if="imgSrc"
        class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        :style="{
          backgroundImage: `url(${imgSrc})`,
          filter: 'blur(10px)'
        }"
      ></div>
      <!-- image -->
      <img
        v-if="!isImageError"
        :src="imgSrc"
        :alt="nodePack.name + ' banner'"
        class="relative w-full h-full object-contain z-10"
      />
      <img
        v-else
        :src="DEFAULT_BANNER"
        :alt="$t('g.defaultBanner')"
        class="relative w-full h-full object-cover z-10"
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
const imgSrc = computed(() => nodePack.banner_url || nodePack.icon)

const { error: isImageError } = useImage(
  computed(() => ({ src: imgSrc.value ?? '', alt: nodePack.name + ' banner' }))
)
</script>
