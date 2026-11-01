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
      ref="primaryImageRef"
      :src="src"
      :class="
        cn(
          'z-1 size-full object-cover object-center',
          contain && 'absolute object-contain backdrop-blur-[10px]',
          classProp
        )
      "
      :alt="alt"
      @load="emit('load')"
      @error="emit('error')"
    />
  </span>
  <div
    v-if="error"
    class="m-8 flex size-full flex-col items-center justify-center"
  >
    <i class="mb-2 icon-[lucide--image] size-12" />
    <span>{{ $t('g.imageFailedToLoad') }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { useImageQuiet } from '@/composables/useImageQuiet'
import { cn } from '@comfyorg/tailwind-utils'

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

const emit = defineEmits<{
  load: []
  error: []
}>()

const primaryImageRef = ref<HTMLImageElement>()

const { error } = useImageQuiet(computed(() => ({ src, alt })))

onMounted(() => {
  const image = primaryImageRef.value
  if (image?.complete && image.naturalWidth > 0) emit('load')
})
</script>
