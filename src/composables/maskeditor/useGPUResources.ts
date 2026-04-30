/// <reference types="@webgpu/types" />
import { computed, onUnmounted, ref, watch } from 'vue'
import { tgpu } from 'typegpu'

import { BrushShape } from '@/extensions/core/maskeditor/types'
import type { Point } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { parseToRgb } from '@/utils/colorUtil'

import type { DirtyRect } from './brushDrawingUtils'
import {
  premultiplyData,
  resetDirtyRect,
  updateDirtyRect
} from './brushDrawingUtils'
import { getEffectiveBrushSize, getEffectiveHardness } from './brushUtils'
import { GPUBrushRenderer } from './gpu/GPUBrushRenderer'
import { clampDirtyRect } from './gpuUtils'

export function useGPUResources() {
  const store = useMaskEditorStore()

  // GPU state — plain variables, not reactive, as Vue doesn't need to track them
  let maskTexture: GPUTexture | null = null
  let rgbTexture: GPUTexture | null = null
  let device: GPUDevice | null = null
  let renderer: GPUBrushRenderer | null = null
  let previewContext: GPUCanvasContext | null = null

  // Readback buffers
  let readbackStorageMask: GPUBuffer | null = null
  let readbackStorageRgb: GPUBuffer | null = null
  let readbackStagingMask: GPUBuffer | null = null
  let readbackStagingRgb: GPUBuffer | null = null
  let currentBufferSize = 0

  // Reactive state shared with useBrushDrawing
  const previewCanvas = ref<HTMLCanvasElement | null>(null)
  const isSavingHistory = ref(false)
  const dirtyRect = ref<DirtyRect>(resetDirtyRect())

  const hasRenderer = computed(() => renderer !== null)

  const isRecreatingTextures = ref(false)

  // ── Watchers ────────────────────────────────────────────────────────────────

  watch(
    () => store.clearTrigger,
    () => clearGPU()
  )

  watch(
    () => store.canvasHistory.currentStateIndex,
    async () => {
      if (isSavingHistory.value) return
      await updateGPUFromCanvas()
      if (renderer && previewContext) renderer.clearPreview(previewContext)
    }
  )

  watch(
    () => store.gpuTexturesNeedRecreation,
    async (needsRecreation) => {
      if (
        !needsRecreation ||
        !device ||
        !store.maskCanvas ||
        isRecreatingTextures.value
      )
        return

      isRecreatingTextures.value = true

      const width = store.gpuTextureWidth
      const height = store.gpuTextureHeight

      try {
        maskTexture?.destroy()
        maskTexture = null
        rgbTexture?.destroy()
        rgbTexture = null

        maskTexture = createTexture(device, width, height)
        rgbTexture = createTexture(device, width, height)

        if (store.pendingGPUMaskData && store.pendingGPURgbData) {
          device.queue.writeTexture(
            { texture: maskTexture },
            store.pendingGPUMaskData,
            { bytesPerRow: width * 4 },
            { width, height }
          )
          device.queue.writeTexture(
            { texture: rgbTexture },
            store.pendingGPURgbData,
            { bytesPerRow: width * 4 },
            { width, height }
          )
        } else {
          await updateGPUFromCanvas()
        }

        if (previewCanvas.value && renderer) {
          previewCanvas.value.width = width
          previewCanvas.value.height = height
        }

        resizeReadbackBuffers(device, width, height)
      } catch (error) {
        console.error(
          '[useGPUResources] Failed to recreate GPU textures:',
          error
        )
      } finally {
        store.gpuTexturesNeedRecreation = false
        store.gpuTextureWidth = 0
        store.gpuTextureHeight = 0
        store.pendingGPUMaskData = null
        store.pendingGPURgbData = null
        isRecreatingTextures.value = false
      }
    }
  )

  onUnmounted(() => {
    renderer?.destroy()
    renderer = null
    maskTexture?.destroy()
    maskTexture = null
    rgbTexture?.destroy()
    rgbTexture = null
    readbackStorageMask?.destroy()
    readbackStorageMask = null
    readbackStorageRgb?.destroy()
    readbackStorageRgb = null
    readbackStagingMask?.destroy()
    readbackStagingMask = null
    readbackStagingRgb?.destroy()
    readbackStagingRgb = null
    // Device is managed by TGPU root; do not destroy it here
  })

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function createTexture(
    gpuDevice: GPUDevice,
    width: number,
    height: number
  ): GPUTexture {
    return gpuDevice.createTexture({
      size: [width, height],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC
    })
  }

  function resizeReadbackBuffers(
    gpuDevice: GPUDevice,
    width: number,
    height: number
  ): void {
    const bufferSize = width * height * 4
    if (currentBufferSize === bufferSize) return

    readbackStorageMask?.destroy()
    readbackStorageRgb?.destroy()
    readbackStagingMask?.destroy()
    readbackStagingRgb?.destroy()

    readbackStorageMask = gpuDevice.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    })
    readbackStorageRgb = gpuDevice.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    })
    readbackStagingMask = gpuDevice.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })
    readbackStagingRgb = gpuDevice.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })
    currentBufferSize = bufferSize
  }

  // ── Internal functions ───────────────────────────────────────────────────────

  async function initTypeGPU(): Promise<void> {
    if (store.tgpuRoot) {
      device = store.tgpuRoot.device
      return
    }
    try {
      const root = await tgpu.init()
      store.tgpuRoot = root
      device = root.device
      console.warn('✅ TypeGPU initialized! Root:', root)
      console.warn('Device info:', root.device.limits)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('Failed to initialize TypeGPU:', message)
    }
  }

  async function updateGPUFromCanvas(): Promise<void> {
    if (
      !device ||
      !maskTexture ||
      !rgbTexture ||
      !store.maskCanvas ||
      !store.rgbCtx
    )
      return

    const w = store.maskCanvas.width
    const h = store.maskCanvas.height

    const maskData = store.maskCtx!.getImageData(0, 0, w, h)
    premultiplyData(maskData.data)
    device.queue.writeTexture(
      { texture: maskTexture },
      maskData.data,
      { bytesPerRow: w * 4 },
      { width: w, height: h }
    )

    const rgbData = store.rgbCtx.getImageData(0, 0, w, h)
    premultiplyData(rgbData.data)
    device.queue.writeTexture(
      { texture: rgbTexture },
      rgbData.data,
      { bytesPerRow: w * 4 },
      { width: w, height: h }
    )
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  async function initGPUResources(): Promise<void> {
    await initTypeGPU()

    if (!store.tgpuRoot || !device) {
      console.warn('TypeGPU not initialized, skipping GPU resource setup')
      return
    }
    if (
      !store.maskCanvas ||
      !store.rgbCanvas ||
      !store.maskCtx ||
      !store.rgbCtx
    ) {
      console.warn('Canvas contexts not ready, skipping GPU resource setup')
      return
    }

    const w = store.maskCanvas.width
    const h = store.maskCanvas.height

    try {
      console.warn(`🎨 Initializing GPU resources for ${w}x${h} canvas`)
      maskTexture = createTexture(device, w, h)
      rgbTexture = createTexture(device, w, h)
      await updateGPUFromCanvas()
      console.warn('✅ GPU resources initialized successfully')
      renderer = new GPUBrushRenderer(
        device,
        navigator.gpu.getPreferredCanvasFormat()
      )
      console.warn('✅ Brush renderer initialized')
    } catch (error) {
      console.error('Failed to initialize GPU resources:', error)
      maskTexture = null
      rgbTexture = null
    }
  }

  function initPreviewCanvas(canvas: HTMLCanvasElement): void {
    if (!device) return
    const ctx = canvas.getContext('webgpu')
    if (!ctx) return
    ctx.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: 'premultiplied'
    })
    previewContext = ctx
    previewCanvas.value = canvas
    console.warn('✅ Preview Canvas Initialized')
  }

  function clearGPU(): void {
    if (!device || !maskTexture || !rgbTexture || !store.maskCanvas) return
    const w = store.maskCanvas.width
    const h = store.maskCanvas.height
    const zeros = new Uint8Array(w * h * 4)
    device.queue.writeTexture(
      { texture: maskTexture },
      zeros,
      { bytesPerRow: w * 4 },
      { width: w, height: h }
    )
    device.queue.writeTexture(
      { texture: rgbTexture },
      zeros,
      { bytesPerRow: w * 4 },
      { width: w, height: h }
    )
  }

  function destroy(): void {
    renderer?.destroy()
    maskTexture?.destroy()
    rgbTexture?.destroy()
    readbackStorageMask?.destroy()
    readbackStorageRgb?.destroy()
    readbackStagingMask?.destroy()
    readbackStagingRgb?.destroy()
    renderer = null
    maskTexture = null
    rgbTexture = null
    readbackStorageMask = null
    readbackStorageRgb = null
    readbackStagingMask = null
    readbackStagingRgb = null
    currentBufferSize = 0
    if (store.tgpuRoot) {
      store.tgpuRoot.destroy()
      store.tgpuRoot = null
    }
    device = null
  }

  // ── Wrappers called by useBrushDrawing ──────────────────────────────────────

  function prepareStroke(): void {
    if (!renderer || !store.maskCanvas) return
    renderer.prepareStroke(store.maskCanvas.width, store.maskCanvas.height)
  }

  function clearPreview(): void {
    if (renderer && previewContext) renderer.clearPreview(previewContext)
  }

  function compositeStroke(isRgb: boolean, isErasing: boolean): void {
    if (!renderer || !maskTexture || !rgbTexture || !store.maskCanvas) return
    const targetTex = isRgb ? rgbTexture : maskTexture
    const { size, hardness, opacity, type } = store.brushSettings
    const effectiveSize = getEffectiveBrushSize(size, hardness)
    const effectiveHardness = getEffectiveHardness(
      size,
      hardness,
      effectiveSize
    )
    const brushShape = type === BrushShape.Rect ? 1 : 0
    renderer.compositeStroke(targetTex.createView(), {
      opacity,
      color: [0, 0, 0],
      hardness: effectiveHardness,
      screenSize: [store.maskCanvas.width, store.maskCanvas.height],
      brushShape,
      isErasing
    })
  }

  async function copyGpuToCanvas(): Promise<{
    maskData: ImageData
    rgbData: ImageData
  }> {
    if (
      !device ||
      !maskTexture ||
      !rgbTexture ||
      !store.maskCanvas ||
      !store.rgbCanvas ||
      !store.maskCtx ||
      !store.rgbCtx ||
      !renderer
    )
      throw new Error('GPU resources not ready')

    const width = store.maskCanvas.width
    const height = store.maskCanvas.height

    resizeReadbackBuffers(device, width, height)

    renderer.prepareReadback(maskTexture, readbackStorageMask!)
    renderer.prepareReadback(rgbTexture, readbackStorageRgb!)

    const encoder = device.createCommandEncoder()
    encoder.copyBufferToBuffer(
      readbackStorageMask!,
      0,
      readbackStagingMask!,
      0,
      currentBufferSize
    )
    encoder.copyBufferToBuffer(
      readbackStorageRgb!,
      0,
      readbackStagingRgb!,
      0,
      currentBufferSize
    )
    device.queue.submit([encoder.finish()])

    await Promise.all([
      readbackStagingMask!.mapAsync(GPUMapMode.READ),
      readbackStagingRgb!.mapAsync(GPUMapMode.READ)
    ])

    const maskDataArr = new Uint8ClampedArray(
      readbackStagingMask!.getMappedRange().slice(0)
    )
    const rgbDataArr = new Uint8ClampedArray(
      readbackStagingRgb!.getMappedRange().slice(0)
    )
    readbackStagingMask!.unmap()
    readbackStagingRgb!.unmap()

    const maskImageData = new ImageData(maskDataArr, width, height)
    const rgbImageData = new ImageData(rgbDataArr, width, height)

    const { dx, dy, dw, dh } = clampDirtyRect(dirtyRect.value, width, height)
    store.maskCtx.putImageData(maskImageData, 0, 0, dx, dy, dw, dh)
    store.rgbCtx.putImageData(rgbImageData, 0, 0, dx, dy, dw, dh)

    return { maskData: maskImageData, rgbData: rgbImageData }
  }

  function gpuRender(points: Point[], skipResampling = false): void {
    if (!renderer || !maskTexture || !rgbTexture) return

    const isRgb = store.activeLayer === 'rgb'
    const color = resolveColor(isRgb)
    const strokePoints = buildStrokePoints(points, skipResampling)

    const { size, hardness } = store.brushSettings
    const effectiveSize = getEffectiveBrushSize(size, hardness)
    const effectiveHardness = getEffectiveHardness(
      size,
      hardness,
      effectiveSize
    )
    const brushShape = store.brushSettings.type === BrushShape.Rect ? 1 : 0

    renderer.renderStrokeToAccumulator(strokePoints, {
      size: effectiveSize,
      opacity: 0.5,
      hardness: effectiveHardness,
      color,
      width: store.maskCanvas!.width,
      height: store.maskCanvas!.height,
      brushShape
    })

    for (const p of strokePoints) {
      dirtyRect.value = updateDirtyRect(
        dirtyRect.value,
        p.x,
        p.y,
        effectiveSize
      )
    }

    if (previewContext) {
      const isErasing =
        store.currentTool === 'eraser' ||
        store.maskCtx?.globalCompositeOperation === 'destination-out'
      const targetTex = isRgb ? rgbTexture : maskTexture
      renderer.blitToCanvas(
        previewContext,
        {
          opacity: store.brushSettings.opacity,
          color,
          hardness: effectiveHardness,
          screenSize: [store.maskCanvas!.width, store.maskCanvas!.height],
          brushShape,
          isErasing
        },
        targetTex ?? undefined
      )
    }
  }

  async function gpuDrawPoint(point: Point, opacity = 1): Promise<void> {
    if (!renderer) return

    const width = store.maskCanvas!.width
    const height = store.maskCanvas!.height
    const { size, hardness } = store.brushSettings
    const effectiveSize = getEffectiveBrushSize(size, hardness)
    const effectiveHardness = getEffectiveHardness(
      size,
      hardness,
      effectiveSize
    )
    const brushShape = store.brushSettings.type === BrushShape.Rect ? 1 : 0

    renderer.renderStrokeToAccumulator(
      [{ x: point.x, y: point.y, pressure: opacity }],
      {
        size: effectiveSize,
        opacity: 0.5,
        hardness: effectiveHardness,
        color: [1, 1, 1],
        width,
        height,
        brushShape
      }
    )

    if (maskTexture && previewContext) {
      const isRgb = store.activeLayer === 'rgb'
      const isErasing =
        store.currentTool === 'eraser' ||
        store.maskCtx?.globalCompositeOperation === 'destination-out'
      renderer.blitToCanvas(
        previewContext,
        {
          opacity: store.brushSettings.opacity,
          color: resolveColor(isRgb),
          hardness: effectiveHardness,
          screenSize: [width, height],
          brushShape,
          isErasing
        },
        undefined
      )
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  function resolveColor(isRgb: boolean): [number, number, number] {
    if (isRgb) {
      const c = parseToRgb(store.rgbColor)
      return [c.r / 255, c.g / 255, c.b / 255]
    }
    const c = store.maskColor as { r: number; g: number; b: number }
    return [c.r / 255, c.g / 255, c.b / 255]
  }

  function buildStrokePoints(
    points: Point[],
    skipResampling: boolean
  ): { x: number; y: number; pressure: number }[] {
    if (skipResampling) {
      return points.map((p) => ({ x: p.x, y: p.y, pressure: 1.0 }))
    }
    const result: { x: number; y: number; pressure: number }[] = []
    const stepPercentage =
      Math.pow(100, store.brushSettings.stepSize / 100) / 100
    const stepSize = Math.max(1.0, store.brushSettings.size * stepPercentage)
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]
      const p2 = points[i + 1]
      const steps = Math.max(
        1,
        Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / stepSize)
      )
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        result.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
          pressure: 1.0
        })
      }
    }
    return result
  }

  return {
    // Lifecycle — spread into useBrushDrawing's public return
    initGPUResources,
    initPreviewCanvas,
    clearGPU,
    destroy,
    // Rendering — called internally by useBrushDrawing
    gpuRender,
    gpuDrawPoint,
    copyGpuToCanvas,
    // Renderer wrappers — called internally by useBrushDrawing
    prepareStroke,
    clearPreview,
    compositeStroke,
    // Shared reactive state
    hasRenderer,
    previewCanvas,
    isSavingHistory,
    dirtyRect
  }
}
