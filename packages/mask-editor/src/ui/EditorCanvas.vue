<template>
  <div
    ref="containerRef"
    data-testid="mask-editor-root"
    class="relative isolate flex size-full flex-col overflow-hidden"
    @contextmenu.prevent
    @dragstart="handleDragStart"
    @keydown.stop
  >
    <div
      id="maskEditorCanvasContainer"
      ref="canvasContainerRef"
      class="absolute inset-0 isolate"
      @contextmenu.prevent
    >
      <canvas
        ref="imgCanvasRef"
        class="absolute top-0 left-0 size-full"
        @contextmenu.prevent
      />
      <canvas
        ref="rgbCanvasRef"
        class="absolute top-0 left-0 z-10 size-full"
        @contextmenu.prevent
      />
      <canvas
        ref="maskCanvasRef"
        class="absolute top-0 left-0 z-30 size-full"
        @contextmenu.prevent
      />
      <canvas
        ref="gpuCanvasRef"
        class="pointer-events-none absolute top-0 left-0 size-full"
        :class="{
          'z-20': store.activeLayer === 'rgb',
          'z-40': store.activeLayer === 'mask'
        }"
      />
      <div ref="canvasBackgroundRef" class="size-full" />
    </div>

    <LoadingOverlay :loading="!initialized" size="sm" />

    <div
      data-testid="mask-editor-ui"
      class="relative isolate flex min-h-0 flex-1 flex-col"
    >
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <ToolPanel v-if="initialized" :tool-manager="toolManager!" />

        <PointerZone
          v-if="initialized"
          :tool-manager="toolManager!"
          :pan-zoom="panZoom!"
        />

        <SidePanel v-if="initialized" :tool-manager="toolManager!" />
      </div>
    </div>

    <BrushCursor v-if="initialized" :container-ref="containerRef" />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { useCanvasManager } from '#/useCanvasManager'
import { useKeyboard } from '#/useKeyboard'
import { usePanAndZoom } from '#/usePanAndZoom'
import { useToolManager } from '#/useToolManager'
import { useMaskEditorStore } from '#/maskEditorStore'

import LoadingOverlay from '@comfyorg/design-system/common/LoadingOverlay'

import BrushCursor from './components/BrushCursor.vue'
import PointerZone from './components/PointerZone.vue'
import SidePanel from './components/SidePanel.vue'
import ToolPanel from './components/ToolPanel.vue'

const { baseImage, maskImage, paintImage, brushAdjustment } = defineProps<{
  baseImage: HTMLImageElement
  maskImage: HTMLImageElement
  paintImage?: HTMLImageElement
  brushAdjustment?: Parameters<typeof useToolManager>[2]
}>()

const emit = defineEmits<{
  ready: []
  error: [error: unknown]
}>()

const store = useMaskEditorStore()
const canvasManager = useCanvasManager()

const containerRef = ref<HTMLElement>()
const canvasContainerRef = ref<HTMLDivElement>()
const imgCanvasRef = ref<HTMLCanvasElement>()
const maskCanvasRef = ref<HTMLCanvasElement>()
const rgbCanvasRef = ref<HTMLCanvasElement>()
const gpuCanvasRef = ref<HTMLCanvasElement>()
const canvasBackgroundRef = ref<HTMLDivElement>()

const initialized = ref(false)

const keyboard = useKeyboard(containerRef)
const panZoom = usePanAndZoom()

const toolManager = useToolManager(keyboard, panZoom, brushAdjustment)

let resizeObserver: ResizeObserver | null = null

const handleDragStart = (event: DragEvent) => {
  if (event.ctrlKey) {
    event.preventDefault()
  }
}

const initUI = async () => {
  if (!containerRef.value) {
    console.error(
      '[MaskEditorContent] Cannot initialize - missing required refs'
    )
    return
  }

  if (
    !imgCanvasRef.value ||
    !maskCanvasRef.value ||
    !rgbCanvasRef.value ||
    !canvasContainerRef.value ||
    !canvasBackgroundRef.value
  ) {
    console.error('[MaskEditorContent] Cannot initialize - missing canvas refs')
    return
  }

  store.maskCanvas = maskCanvasRef.value
  store.rgbCanvas = rgbCanvasRef.value
  store.imgCanvas = imgCanvasRef.value
  store.canvasContainer = canvasContainerRef.value
  store.canvasBackground = canvasBackgroundRef.value

  try {
    await nextTick()

    const image = await canvasManager.initializeImages(
      baseImage,
      maskImage,
      paintImage
    )

    await panZoom.initializeCanvasPanZoom(image, containerRef.value)

    store.canvasHistory.saveInitialState()

    await toolManager.brushDrawing.initGPUResources()
    if (gpuCanvasRef.value) {
      gpuCanvasRef.value.width = maskCanvasRef.value.width
      gpuCanvasRef.value.height = maskCanvasRef.value.height

      toolManager.brushDrawing.initPreviewCanvas(gpuCanvasRef.value)
    }

    initialized.value = true
    emit('ready')
  } catch (error) {
    emit('error', error)
  }
}

onMounted(() => {
  keyboard.addListeners()

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(async () => {
      if (panZoom) {
        await panZoom.invalidatePanZoom()
      }
    })
    resizeObserver.observe(containerRef.value)
  }

  void initUI()
})

onBeforeUnmount(() => {
  keyboard?.removeListeners()

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  store.canvasHistory.clearStates()

  store.resetState()
})
</script>
