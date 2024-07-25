<template>
  <div
    ref="canvasContainerRef"
    class="graph-canvas-container flex w-full h-full relative overflow-hidden"
  >
    <canvas ref="canvasRef" id="graph-canvas" class="w-full h-full" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { app as comfyApp } from '@/scripts/app'
import { useMainStore } from '@/stores'

const emit = defineEmits(['ready'])

const mainStore = useMainStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasContainerRef = ref<HTMLDivElement | null>(null)

onMounted(async () => {
  mainStore.spinner(true)
  await comfyApp.setup(canvasRef.value)
  mainStore.spinner(false)

  /* TODO:
   * remove theses exposition to window's scope when we have the plugin SDK
   * no plugin or extension should be able to access our DOM directly
   */
  window['app'] = comfyApp
  window['graph'] = comfyApp.graph
  emit('ready')
})
</script>
