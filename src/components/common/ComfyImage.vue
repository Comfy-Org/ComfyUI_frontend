<!-- A image with placeholder fallback on error -->
<template>
  <span v-if="!imageBroken" class="contents" :class="{ relative: contain }">
    <img
      v-if="contain"
      :src="src"
      :data-test="src"
      class="absolute top-0 left-0 size-full object-cover"
      :style="{ 'background-image': `url(${src})` }"
      :alt="alt"
      @error="handleImageError"
    />
    <img
      :src="src"
      :class="
        cn(
          'size-full object-cover object-center z-1',
          contain && 'object-contain backdrop-blur-[10px] absolute',
          classProp
        )
      "
      :alt="alt"
      @error="handleImageError"
    />
  </span>
  <div
    v-if="imageBroken"
    class="flex flex-col items-center justify-center size-full m-8"
  >
    <i class="pi pi-image text-5xl mb-2" />
    <span>{{ $t('g.imageFailedToLoad') }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const {
  src,
  class: classProp,
  contain = false,
  alt = 'Image content'
} = defineProps<{
  src: string
  class?:
    | string
    | Record<string, boolean>
    | (string | Record<string, boolean>)[]
  contain?: boolean
  alt?: string
}>()

const imageBroken = ref(false)
function handleImageError() {
  imageBroken.value = true
}
</script>
