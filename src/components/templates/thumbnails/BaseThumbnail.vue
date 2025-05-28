<template>
  <div class="relative w-64 h-64 rounded-t-lg overflow-hidden select-none">
    <div
      v-if="!error"
      ref="contentRef"
      class="w-full h-full transform-gpu transition-transform duration-1000 ease-out"
      :style="
        isHovered ? { transform: `scale(${1 + hoverZoom / 100})` } : undefined
      "
    >
      <slot />
    </div>
    <div v-else class="w-full h-full flex items-center justify-center">
      <i class="pi pi-file text-4xl" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { onMounted, ref } from 'vue'

const error = ref(false)
const contentRef = ref<HTMLElement | null>(null)

const { hoverZoom = 4 } = defineProps<{
  hoverZoom?: number
  isHovered?: boolean
}>()

onMounted(() => {
  const images = Array.from(contentRef.value?.getElementsByTagName('img') ?? [])
  images.forEach((img) => {
    useEventListener(img, 'error', () => {
      error.value = true
    })
  })
})
</script>
<style scoped>
img {
  transition: transform 1s cubic-bezier(0.2, 0, 0.4, 1);
}
</style>
