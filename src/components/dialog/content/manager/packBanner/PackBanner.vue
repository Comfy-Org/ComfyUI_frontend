<template>
  <div class="w-full aspect-[7/3] overflow-hidden">
    <!-- default banner show -->
    <div v-if="showDefaultBanner" class="w-full h-full">
      <img
        :src="DEFAULT_BANNER"
        alt="default banner"
        class="w-full h-full object-cover"
      />
    </div>
    <!-- banner_url or icon show -->
    <div v-else class="relative w-full h-full">
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
        :src="isImageError ? DEFAULT_BANNER : imgSrc"
        :alt="nodePack.name + ' banner'"
        :class="
          isImageError
            ? 'relative w-full h-full object-cover z-10'
            : 'relative w-full h-full object-contain z-10'
        "
        @error="isImageError = true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { components } from '@/types/comfyRegistryTypes'

const DEFAULT_BANNER = '/assets/images/fallback-gradient-avatar.svg'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const isImageError = ref(false)

const showDefaultBanner = computed(() => !nodePack.banner_url && !nodePack.icon)
const imgSrc = computed(() => nodePack.banner_url || nodePack.icon)
</script>
