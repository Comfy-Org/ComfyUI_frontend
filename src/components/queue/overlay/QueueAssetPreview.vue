<template>
  <div class="w-[300px] min-w-[260px] rounded-lg shadow-md">
    <div class="p-[var(--spacing-spacing-sm)]">
      <div class="relative aspect-square w-full overflow-hidden rounded-lg">
        <img
          ref="imgRef"
          :src="imageUrl"
          :alt="name"
          class="h-full w-full cursor-pointer object-contain"
          @click="$emit('click')"
          @load="onImgLoad"
        />
        <div
          v-if="timeLabel"
          class="absolute bottom-2 left-2 px-2 py-0.5 text-xs text-white"
          :style="{
            borderRadius: 'var(--corner-radius-corner-radius-sm, 0.25rem)',
            background: 'rgba(217, 217, 217, 0.40)',
            backdropFilter: 'blur(2px)'
          }"
        >
          {{ timeLabel }}
        </div>
      </div>
      <div class="mt-2 text-center">
        <div
          class="truncate text-[0.875rem] leading-normal font-semibold text-white"
          :title="name"
        >
          {{ name }}
        </div>
        <div
          v-if="width && height"
          class="mt-1 text-[0.75rem] leading-normal text-[var(--color-text-secondary)]"
        >
          {{ width }}x{{ height }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  imageUrl: string
  name: string
  timeLabel?: string
}>()

defineEmits<{
  (e: 'click'): void
}>()

const imgRef = ref<HTMLImageElement | null>(null)
const width = ref<number | null>(null)
const height = ref<number | null>(null)

const onImgLoad = () => {
  const el = imgRef.value
  if (!el) return
  width.value = el.naturalWidth || null
  height.value = el.naturalHeight || null
}
</script>
