<template>
  <div
    ref="container"
    class="w-full h-full relative comfy-load-3d"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
    @mousedown.stop
    @mousemove.stop
    @mouseup.stop
  >
    <LoadingOverlay
      ref="loadingOverlayRef"
      :loading="props.loading"
      :loading-message="props.loadingMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import LoadingOverlay from '@/components/load3d/LoadingOverlay.vue'

const props = defineProps<{
  initializeLoad3d: any
  cleanup: any
  loading: boolean
  loadingMessage: string
}>()

const container = ref<HTMLElement | null>(null)
const loadingOverlayRef = ref<InstanceType<typeof LoadingOverlay> | null>(null)

onMounted(() => {
  if (container.value) {
    props.initializeLoad3d(container.value)
  }
})

onUnmounted(() => {
  props.cleanup()
})
</script>
