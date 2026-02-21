<template>
  <div
    class="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted"
  >
    <div
      v-if="normalizedThumbnailUrl && isLoading"
      class="absolute inset-0 animate-pulse bg-muted-foreground/20"
    />
    <img
      v-if="normalizedThumbnailUrl && !error"
      :src="normalizedThumbnailUrl"
      :alt="name"
      :class="
        cn(
          'size-full object-cover transition-opacity duration-200',
          isReady ? 'opacity-100' : 'opacity-0'
        )
      "
      @error="
        $emit('thumbnailError', { name, thumbnailUrl: normalizedThumbnailUrl })
      "
    />
    <i
      v-if="!normalizedThumbnailUrl || error"
      class="icon-[lucide--image] size-4 text-muted-foreground"
    />
  </div>
</template>

<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed, watchEffect } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { name, thumbnailUrl } = defineProps<{
  name: string
  thumbnailUrl: unknown
}>()

defineEmits<{
  thumbnailError: [{ name: string; thumbnailUrl: string | null }]
}>()

const normalizedThumbnailUrl = computed(() =>
  typeof thumbnailUrl === 'string' && thumbnailUrl.length > 0
    ? thumbnailUrl
    : null
)

watchEffect(() => {
  if (thumbnailUrl != null && typeof thumbnailUrl !== 'string') {
    console.warn('[share][assets][invalid-thumbnail-type]', {
      name,
      receivedType: typeof thumbnailUrl,
      value: thumbnailUrl
    })
  }
})

const imageOptions = computed(() => ({
  src: normalizedThumbnailUrl.value ?? ''
}))

const { isReady, isLoading, error } = useImage(imageOptions)
</script>
