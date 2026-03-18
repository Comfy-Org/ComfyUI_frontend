<!-- A image with placeholder fallback on error -->
<template>
  <span v-if="!error" :class="cn('contents', contain && 'relative')">
    <img
      v-if="contain"
      :src="src"
      :data-test="src"
      class="absolute inset-0 object-cover"
      :style="{ 'background-image': `url(${src})` }"
      :alt="alt"
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
    />
  </span>
  <div
    v-if="error"
    class="m-8 flex size-full flex-col items-center justify-center"
  >
    <i class="pi pi-image mb-2 text-5xl" />
    <span>{{ $t('g.imageFailedToLoad') }}</span>
  </div>
</template>

<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed } from 'vue'

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

const { error } = useImage(computed(() => ({ src, alt })))
</script>
