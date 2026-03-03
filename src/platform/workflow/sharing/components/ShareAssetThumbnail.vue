<template>
  <div
    class="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
  >
    <Skeleton
      v-if="normalizedPreviewUrl && isLoading"
      class="absolute inset-0"
    />
    <img
      v-if="normalizedPreviewUrl && !error"
      :src="normalizedPreviewUrl"
      :alt="name"
      :class="
        cn(
          'size-full object-cover transition-opacity duration-200',
          isReady ? 'opacity-100' : 'opacity-0'
        )
      "
      @error="
        $emit('thumbnailError', { name, previewUrl: normalizedPreviewUrl })
      "
    />
    <i
      v-if="!normalizedPreviewUrl || error"
      class="icon-[lucide--image] size-4 text-muted-foreground"
    />
  </div>
</template>

<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed, watchEffect } from 'vue'

import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { cn } from '@/utils/tailwindUtil'

const { name, previewUrl } = defineProps<{
  name: string
  previewUrl: string | null | undefined
}>()

defineEmits<{
  thumbnailError: [{ name: string; previewUrl: string | null }]
}>()

const normalizedPreviewUrl = computed(() =>
  typeof previewUrl === 'string' && previewUrl.length > 0 ? previewUrl : null
)

watchEffect(() => {
  if (previewUrl != null && typeof previewUrl !== 'string') {
    console.warn('[share][assets][invalid-preview-url-type]', {
      name,
      receivedType: typeof previewUrl,
      value: previewUrl
    })
  }
})

const imageOptions = computed(() => ({
  src: normalizedPreviewUrl.value ?? ''
}))

const { isReady, isLoading, error } = useImage(imageOptions)
</script>
