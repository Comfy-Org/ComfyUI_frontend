<template>
  <div class="relative w-64 h-64 rounded-t-lg overflow-hidden select-none">
    <div v-if="!error" ref="contentRef">
      <slot />
    </div>
    <div
      v-else
      class="w-full h-full flex items-center justify-center bg-surface-card"
    >
      <i class="pi pi-file text-4xl text-surface-600" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { onMounted, ref } from 'vue'

const error = ref(false)
const contentRef = ref<HTMLElement | null>(null)

onMounted(() => {
  const images = Array.from(contentRef.value?.getElementsByTagName('img') ?? [])
  images.forEach((img) => {
    useEventListener(img, 'error', () => {
      error.value = true
    })
  })
})
</script>
