<template>
  <div class="w-[300px] min-w-[260px] rounded-lg shadow-md">
    <div class="p-3">
      <div class="relative aspect-square w-full overflow-hidden rounded-lg">
        <img
          :src="imageUrl"
          :alt="name"
          class="h-full w-full cursor-pointer object-contain"
          @click="$emit('image-click')"
        />
        <div
          v-if="timeLabel"
          class="absolute bottom-2 left-2 rounded px-2 py-0.5 text-xs text-text-primary"
          :style="{
            background: 'rgba(217, 217, 217, 0.40)',
            backdropFilter: 'blur(2px)'
          }"
        >
          {{ timeLabel }}
        </div>
      </div>
      <div class="mt-2 text-center">
        <div
          class="truncate text-[0.875rem] leading-normal font-semibold text-text-primary"
          :title="name"
        >
          {{ name }}
        </div>
        <div
          v-if="width && height"
          class="mt-1 text-[0.75rem] leading-normal text-text-secondary"
        >
          {{ width }}x{{ height }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

const { imageUrl, name } = defineProps<{
  imageUrl: string
  name: string
  timeLabel?: string
}>()

defineEmits(['image-click'])

const { state, isReady } = useImage({ src: imageUrl, alt: name })

const width = computed(() =>
  isReady.value ? (state.value?.naturalWidth ?? null) : null
)
const height = computed(() =>
  isReady.value ? (state.value?.naturalHeight ?? null) : null
)
</script>
