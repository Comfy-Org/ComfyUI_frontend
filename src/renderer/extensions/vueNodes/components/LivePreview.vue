<template>
  <template v-if="imageUrl">
    <div
      v-if="imageError"
      class="text-pure-white flex h-full w-full flex-col items-center justify-center text-center"
    >
      <i-lucide:image-off class="mb-1 size-8 text-smoke-500" />
      <p class="text-xs text-smoke-400">{{ $t('g.imageFailedToLoad') }}</p>
    </div>
    <img
      v-else
      :src="imageUrl"
      :alt="$t('g.liveSamplingPreview')"
      class="pointer-events-none w-full object-contain contain-size min-h-55 flex-1"
    />
    <div class="text-node-component-header-text mt-1 text-center text-xs">
      {{
        imageError
          ? $t('g.errorLoadingImage')
          : actualDimensions || $t('g.calculatingDimensions')
      }}
    </div>
  </template>
</template>

<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed } from 'vue'

interface LivePreviewProps {
  imageUrl: string
}

const props = defineProps<LivePreviewProps>()

const {
  state,
  error: imageError,
  isReady
} = useImage(computed(() => ({ src: props.imageUrl ?? '', alt: '' })))

const actualDimensions = computed(() => {
  if (
    !isReady.value ||
    !state.value?.naturalWidth ||
    !state.value?.naturalHeight
  )
    return null
  return `${state.value.naturalWidth} x ${state.value.naturalHeight}`
})
</script>
