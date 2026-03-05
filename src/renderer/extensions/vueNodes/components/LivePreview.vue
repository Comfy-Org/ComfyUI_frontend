<template>
  <template v-if="imageUrl">
    <div
      v-if="imageError"
      class="text-pure-white flex h-full w-full flex-col items-center justify-center text-center"
    >
      <i-lucide:image-off class="mb-1 size-8 text-smoke-500" />
      <p class="text-xs text-smoke-400">{{ $t('g.imageFailedToLoad') }}</p>
    </div>
    <div
      v-else
      :class="
        cn(
          'min-h-55 flex-1 overflow-hidden',
          showCheckerboard && 'bg-checkerboard'
        )
      "
    >
      <img
        :src="imageUrl"
        :alt="$t('g.liveSamplingPreview')"
        class="pointer-events-none w-full object-contain contain-size"
        @load="handleImageLoad"
        @error="handleImageError"
      />
    </div>
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
import { computed, ref, watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { cn } from '@/utils/tailwindUtil'

interface LivePreviewProps {
  imageUrl: string
}

const props = defineProps<LivePreviewProps>()

const showCheckerboard = computed(() =>
  useSettingStore().get('Comfy.Preview.CheckerboardBackground')
)
const actualDimensions = ref<string | null>(null)
const imageError = ref(false)

watch(
  () => props.imageUrl,
  () => {
    // Reset states when URL changes
    actualDimensions.value = null
    imageError.value = false
  }
)

const handleImageLoad = (event: Event) => {
  if (!event.target || !(event.target instanceof HTMLImageElement)) return
  const img = event.target
  imageError.value = false
  if (img.naturalWidth && img.naturalHeight) {
    actualDimensions.value = `${img.naturalWidth} x ${img.naturalHeight}`
  }
}

const handleImageError = () => {
  imageError.value = true
  actualDimensions.value = null
}
</script>
