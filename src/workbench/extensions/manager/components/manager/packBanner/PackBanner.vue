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
            ? 'relative z-10 size-full object-cover'
            : 'relative z-10 size-full object-contain'
        "
        @error="isImageError = true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'

const DEFAULT_BANNER = '/assets/images/fallback-gradient-avatar.svg'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const isImageError = ref(false)

const showDefaultBanner = computed(() => !nodePack.banner_url && !nodePack.icon)
const imgSrc = computed(() => nodePack.banner_url || nodePack.icon)
</script>
