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
          'z-1 size-full object-cover object-center',
          contain && 'absolute object-contain backdrop-blur-[10px]',
          classProp
        )
      "
      :alt="alt"
      @error="handleImageError"
    />
  </span>
  <div
    v-if="imageBroken"
    class="m-8 flex size-full flex-col items-center justify-center"
  >
    <i class="pi pi-image mb-2 text-5xl" />
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
