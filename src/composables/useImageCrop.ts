import { useResizeObserver } from '@vueuse/core'
import type { Ref } from 'vue'
import { computed, onMounted, ref, watch } from 'vue'

import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { BoundingBoxValue } from '@/lib/litegraph/src/types/widgets'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'

type ResizeDirection =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se'

const HANDLE_SIZE = 8
const CORNER_SIZE = 10
const MIN_CROP_SIZE = 16
const CROP_BOX_BORDER = 2

interface UseImageCropOptions {
  imageEl: Ref<HTMLImageElement | null>
  containerEl: Ref<HTMLDivElement | null>
  modelValue: Ref<BoundingBoxValue>
}

export function useImageCrop(nodeId: NodeId, options: UseImageCropOptions) {
  const { imageEl, containerEl, modelValue } = options
  const nodeOutputStore = useNodeOutputStore()

  const node = ref<LGraphNode | null>(null)

  const imageUrl = ref<string | null>(null)
  const isLoading = ref(false)

  const naturalWidth = ref(0)
  const naturalHeight = ref(0)
  const displayedWidth = ref(0)
  const displayedHeight = ref(0)
  const scaleFactor = ref(1)
  const imageOffsetX = ref(0)
  const imageOffsetY = ref(0)

  const cropX = computed({
    get: () => modelValue.value.x,
    set: (v: number) => {
      modelValue.value.x = v
    }
  })

  const cropY = computed({
    get: () => modelValue.value.y,
    set: (v: number) => {
      modelValue.value.y = v
    }
  })

  const cropWidth = computed({
    get: () => modelValue.value.width || 512,
    set: (v: number) => {
      modelValue.value.width = v
    }
  })

  const cropHeight = computed({
    get: () => modelValue.value.height || 512,
    set: (v: number) => {
      modelValue.value.height = v
    }
  })

  const isDragging = ref(false)
  const dragStartX = ref(0)
  const dragStartY = ref(0)
  const dragStartCropX = ref(0)
  const dragStartCropY = ref(0)

  const isResizing = ref(false)
  const resizeDirection = ref<ResizeDirection | null>(null)
  const resizeStartX = ref(0)
  const resizeStartY = ref(0)
  const resizeStartCropX = ref(0)
  const resizeStartCropY = ref(0)
  const resizeStartCropWidth = ref(0)
  const resizeStartCropHeight = ref(0)

  useResizeObserver(containerEl, () => {
    if (imageEl.value && imageUrl.value) {
      updateDisplayedDimensions()
    }
  })

  const getInputImageUrl = (): string | null => {
    if (!node.value) return null

    const inputNode = node.value.getInputNode(0)

    if (!inputNode) return null

    const urls = nodeOutputStore.getNodeImageUrls(inputNode)

    if (urls?.length) {
      return urls[0]
    }

    return null
  }

  const updateImageUrl = () => {
    imageUrl.value = getInputImageUrl()
  }

  const updateDisplayedDimensions = () => {
    if (!imageEl.value || !containerEl.value) return

    const img = imageEl.value
    const container = containerEl.value

    naturalWidth.value = img.naturalWidth
    naturalHeight.value = img.naturalHeight

    if (naturalWidth.value <= 0 || naturalHeight.value <= 0) {
      scaleFactor.value = 1
      return
    }

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    const imageAspect = naturalWidth.value / naturalHeight.value
    const containerAspect = containerWidth / containerHeight

    if (imageAspect > containerAspect) {
      displayedWidth.value = containerWidth
      displayedHeight.value = containerWidth / imageAspect
      imageOffsetX.value = 0
      imageOffsetY.value = (containerHeight - displayedHeight.value) / 2
    } else {
      displayedHeight.value = containerHeight
      displayedWidth.value = containerHeight * imageAspect
      imageOffsetX.value = (containerWidth - displayedWidth.value) / 2
      imageOffsetY.value = 0
    }

    if (naturalWidth.value <= 0 || displayedWidth.value <= 0) {
      scaleFactor.value = 1
    } else {
      scaleFactor.value = displayedWidth.value / naturalWidth.value
    }
  }

  const getEffectiveScale = (): number => {
    const container = containerEl.value

    if (!container || naturalWidth.value <= 0 || displayedWidth.value <= 0) {
      return 1
    }

    const rect = container.getBoundingClientRect()
    const clientWidth = container.clientWidth

    if (!clientWidth || !rect.width) return 1

    const renderedDisplayedWidth =
      (displayedWidth.value / clientWidth) * rect.width

    return renderedDisplayedWidth / naturalWidth.value
  }

  const cropBoxStyle = computed(() => ({
    left: `${imageOffsetX.value + cropX.value * scaleFactor.value - CROP_BOX_BORDER}px`,
    top: `${imageOffsetY.value + cropY.value * scaleFactor.value - CROP_BOX_BORDER}px`,
    width: `${cropWidth.value * scaleFactor.value}px`,
    height: `${cropHeight.value * scaleFactor.value}px`
  }))

  const cropImageStyle = computed(() => {
    if (!imageUrl.value) return {}

    return {
      backgroundImage: `url(${imageUrl.value})`,
      backgroundSize: `${displayedWidth.value}px ${displayedHeight.value}px`,
      backgroundPosition: `-${cropX.value * scaleFactor.value}px -${cropY.value * scaleFactor.value}px`,
      backgroundRepeat: 'no-repeat'
    }
  })

  interface ResizeHandle {
    direction: ResizeDirection
    class: string
    style: {
      left: string
      top: string
      width?: string
      height?: string
    }
  }

  const resizeHandles = computed<ResizeHandle[]>(() => {
    const x = imageOffsetX.value + cropX.value * scaleFactor.value
    const y = imageOffsetY.value + cropY.value * scaleFactor.value
    const w = cropWidth.value * scaleFactor.value
    const h = cropHeight.value * scaleFactor.value

    return [
      {
        direction: 'top',
        class: 'h-2 cursor-ns-resize',
        style: {
          left: `${x + HANDLE_SIZE}px`,
          top: `${y - HANDLE_SIZE / 2}px`,
          width: `${Math.max(0, w - HANDLE_SIZE * 2)}px`
        }
      },
      {
        direction: 'bottom',
        class: 'h-2 cursor-ns-resize',
        style: {
          left: `${x + HANDLE_SIZE}px`,
          top: `${y + h - HANDLE_SIZE / 2}px`,
          width: `${Math.max(0, w - HANDLE_SIZE * 2)}px`
        }
      },
      {
        direction: 'left',
        class: 'w-2 cursor-ew-resize',
        style: {
          left: `${x - HANDLE_SIZE / 2}px`,
          top: `${y + HANDLE_SIZE}px`,
          height: `${Math.max(0, h - HANDLE_SIZE * 2)}px`
        }
      },
      {
        direction: 'right',
        class: 'w-2 cursor-ew-resize',
        style: {
          left: `${x + w - HANDLE_SIZE / 2}px`,
          top: `${y + HANDLE_SIZE}px`,
          height: `${Math.max(0, h - HANDLE_SIZE * 2)}px`
        }
      },
      {
        direction: 'nw',
        class: 'cursor-nwse-resize rounded-sm bg-white/80',
        style: {
          left: `${x - CORNER_SIZE / 2}px`,
          top: `${y - CORNER_SIZE / 2}px`,
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`
        }
      },
      {
        direction: 'ne',
        class: 'cursor-nesw-resize rounded-sm bg-white/80',
        style: {
          left: `${x + w - CORNER_SIZE / 2}px`,
          top: `${y - CORNER_SIZE / 2}px`,
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`
        }
      },
      {
        direction: 'sw',
        class: 'cursor-nesw-resize rounded-sm bg-white/80',
        style: {
          left: `${x - CORNER_SIZE / 2}px`,
          top: `${y + h - CORNER_SIZE / 2}px`,
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`
        }
      },
      {
        direction: 'se',
        class: 'cursor-nwse-resize rounded-sm bg-white/80',
        style: {
          left: `${x + w - CORNER_SIZE / 2}px`,
          top: `${y + h - CORNER_SIZE / 2}px`,
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`
        }
      }
    ]
  })

  const handleImageLoad = () => {
    isLoading.value = false
    updateDisplayedDimensions()
  }

  const handleImageError = () => {
    isLoading.value = false
    imageUrl.value = null
  }

  const capturePointer = (e: PointerEvent) =>
    (e.target as HTMLElement).setPointerCapture(e.pointerId)

  const releasePointer = (e: PointerEvent) =>
    (e.target as HTMLElement).releasePointerCapture(e.pointerId)

  const handleDragStart = (e: PointerEvent) => {
    if (!imageUrl.value) return

    isDragging.value = true
    dragStartX.value = e.clientX
    dragStartY.value = e.clientY
    dragStartCropX.value = cropX.value
    dragStartCropY.value = cropY.value
    capturePointer(e)
  }

  const handleDragMove = (e: PointerEvent) => {
    if (!isDragging.value) return

    const effectiveScale = getEffectiveScale()
    if (effectiveScale === 0) return

    const deltaX = (e.clientX - dragStartX.value) / effectiveScale
    const deltaY = (e.clientY - dragStartY.value) / effectiveScale

    const maxX = naturalWidth.value - cropWidth.value
    const maxY = naturalHeight.value - cropHeight.value

    cropX.value = Math.round(
      Math.max(0, Math.min(maxX, dragStartCropX.value + deltaX))
    )
    cropY.value = Math.round(
      Math.max(0, Math.min(maxY, dragStartCropY.value + deltaY))
    )
  }

  const handleDragEnd = (e: PointerEvent) => {
    if (!isDragging.value) return

    isDragging.value = false
    releasePointer(e)
  }

  const handleResizeStart = (e: PointerEvent, direction: ResizeDirection) => {
    if (!imageUrl.value) return

    e.stopPropagation()
    isResizing.value = true
    resizeDirection.value = direction

    resizeStartX.value = e.clientX
    resizeStartY.value = e.clientY
    resizeStartCropX.value = cropX.value
    resizeStartCropY.value = cropY.value
    resizeStartCropWidth.value = cropWidth.value
    resizeStartCropHeight.value = cropHeight.value
    capturePointer(e)
  }

  const handleResizeMove = (e: PointerEvent) => {
    if (!isResizing.value || !resizeDirection.value) return

    const effectiveScale = getEffectiveScale()
    if (effectiveScale === 0) return

    const dir = resizeDirection.value
    const deltaX = (e.clientX - resizeStartX.value) / effectiveScale
    const deltaY = (e.clientY - resizeStartY.value) / effectiveScale

    const affectsLeft = dir === 'left' || dir === 'nw' || dir === 'sw'
    const affectsRight = dir === 'right' || dir === 'ne' || dir === 'se'
    const affectsTop = dir === 'top' || dir === 'nw' || dir === 'ne'
    const affectsBottom = dir === 'bottom' || dir === 'sw' || dir === 'se'

    let newX = resizeStartCropX.value
    let newY = resizeStartCropY.value
    let newWidth = resizeStartCropWidth.value
    let newHeight = resizeStartCropHeight.value

    if (affectsLeft) {
      const maxDeltaX = resizeStartCropWidth.value - MIN_CROP_SIZE
      const minDeltaX = -resizeStartCropX.value
      const clampedDeltaX = Math.max(minDeltaX, Math.min(maxDeltaX, deltaX))
      newX = resizeStartCropX.value + clampedDeltaX
      newWidth = resizeStartCropWidth.value - clampedDeltaX
    } else if (affectsRight) {
      const maxWidth = naturalWidth.value - resizeStartCropX.value
      newWidth = Math.max(
        MIN_CROP_SIZE,
        Math.min(maxWidth, resizeStartCropWidth.value + deltaX)
      )
    }

    if (affectsTop) {
      const maxDeltaY = resizeStartCropHeight.value - MIN_CROP_SIZE
      const minDeltaY = -resizeStartCropY.value
      const clampedDeltaY = Math.max(minDeltaY, Math.min(maxDeltaY, deltaY))
      newY = resizeStartCropY.value + clampedDeltaY
      newHeight = resizeStartCropHeight.value - clampedDeltaY
    } else if (affectsBottom) {
      const maxHeight = naturalHeight.value - resizeStartCropY.value
      newHeight = Math.max(
        MIN_CROP_SIZE,
        Math.min(maxHeight, resizeStartCropHeight.value + deltaY)
      )
    }

    if (affectsLeft || affectsRight) {
      cropX.value = Math.round(newX)
      cropWidth.value = Math.round(newWidth)
    }
    if (affectsTop || affectsBottom) {
      cropY.value = Math.round(newY)
      cropHeight.value = Math.round(newHeight)
    }
  }

  const handleResizeEnd = (e: PointerEvent) => {
    if (!isResizing.value) return

    isResizing.value = false
    resizeDirection.value = null
    releasePointer(e)
  }

  const initialize = () => {
    if (nodeId != null) {
      node.value = app.rootGraph?.getNodeById(nodeId) || null
    }

    updateImageUrl()
  }

  watch(
    () => nodeOutputStore.nodeOutputs,
    () => updateImageUrl(),
    { deep: true }
  )

  watch(
    () => nodeOutputStore.nodePreviewImages,
    () => updateImageUrl(),
    { deep: true }
  )

  onMounted(initialize)

  return {
    imageUrl,
    isLoading,

    cropX,
    cropY,
    cropWidth,
    cropHeight,

    cropBoxStyle,
    cropImageStyle,
    resizeHandles,

    handleImageLoad,
    handleImageError,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd
  }
}
