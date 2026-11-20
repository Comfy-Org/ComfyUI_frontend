import { useEventListener } from '@vueuse/core'
import { attempt } from 'es-toolkit'
import { ref } from 'vue'

import type {
  Bounds,
  CompassCorners,
  Point2D as Point,
  Size2D as Size
} from '@comfyorg/shared-frontend-utils/geometry'
import type { Positionable } from '@comfyorg/graph-model/interfaces'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { resizeBox } from '@comfyorg/graph-model/arrange/cornerResize'
import { startResizeSnap } from '@/lib/litegraph/src/canvas/gestureSnap'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { removeNodeTitleHeight } from '@/renderer/core/layout/utils/nodeSizeUtil'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'
import { useNodeSnap } from '@/renderer/extensions/vueNodes/composables/useNodeSnap'
import { useShiftKeySync } from '@/renderer/extensions/vueNodes/composables/useShiftKeySync'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

interface ResizeOrigin {
  element: HTMLElement
  position: Point
  snapItem?: Positionable
}

export interface ResizeCallbackPayload {
  size: Size
  position?: Point
}

/**
 * Composable for node resizing functionality from any corner.
 *
 * Provides resize handle interaction that integrates with the layout system.
 * Handles pointer capture, coordinate calculations, size constraints,
 * and position adjustments for non-SE corners.
 */
export function useNodeResize(
  resizeCallback: (payload: ResizeCallbackPayload, element: HTMLElement) => void
) {
  const transformState = useTransformState()

  const isResizing = ref(false)
  const resizeStartPointer = ref<Point | null>(null)
  const resizeStartSize = ref<Size | null>(null)
  const resizeStartPosition = ref<Point | null>(null)
  const resizeCorner = ref<CompassCorners>('SE')

  const { shouldSnap, gridSize } = useNodeSnap()

  const { trackShiftKey } = useShiftKeySync()

  const canvasStore = useCanvasStore()

  let endActiveResize: (() => void) | undefined

  const startResize = (
    event: PointerEvent,
    corner: CompassCorners,
    { element: nodeElement, position, snapItem }: ResizeOrigin
  ) => {
    event.stopPropagation()

    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return

    endActiveResize?.()

    const rect = nodeElement.getBoundingClientRect()
    const scale = transformState.camera.z

    const startSize: Size = {
      width: rect.width / scale,
      height: rect.height / scale
    }

    const measureMinContentHeight = (candidateWidth: number) => {
      const savedWidth = nodeElement.style.getPropertyValue('--node-width')
      const savedHeight = nodeElement.style.getPropertyValue('--node-height')
      nodeElement.style.setProperty('--node-width', `${candidateWidth}px`)
      nodeElement.style.setProperty('--node-height', '0px')
      const measured = nodeElement.getBoundingClientRect().height
      nodeElement.style.setProperty('--node-height', savedHeight || '')
      nodeElement.style.setProperty('--node-width', savedWidth || '')
      const currentScale = transformState.camera.z || 1
      return measured / currentScale
    }

    const { canvas } = canvasStore
    const resizeSnap =
      canvas && snapItem ? startResizeSnap(canvas, snapItem) : undefined
    const startPosition: Point = { ...position }

    const stopShiftSync = trackShiftKey(event.shiftKey)

    target.setPointerCapture(event.pointerId)

    layoutStore.isResizingVueNodes.value = true
    isResizing.value = true
    resizeStartPointer.value = { x: event.clientX, y: event.clientY }
    resizeStartSize.value = startSize
    resizeStartPosition.value = startPosition
    resizeCorner.value = corner

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (
        !isResizing.value ||
        !resizeStartPointer.value ||
        !resizeStartSize.value ||
        !resizeStartPosition.value
      ) {
        return
      }

      const scale = transformState.camera.z
      const deltaX =
        (moveEvent.clientX - resizeStartPointer.value.x) / (scale || 1)
      const deltaY =
        (moveEvent.clientY - resizeStartPointer.value.y) / (scale || 1)

      const activeCorner = resizeCorner.value
      const snapToGrid = shouldSnap(moveEvent)
      const minWidth =
        parseFloat(nodeElement.style.getPropertyValue('min-width') || '0') ||
        MIN_NODE_WIDTH
      const snapBody = (box: Bounds, min: Size): Bounds => {
        if (!resizeSnap) return box
        const titleBand = box.height - removeNodeTitleHeight(box.height)
        const snapped = resizeSnap.resize(
          { ...box, height: box.height - titleBand },
          activeCorner,
          { snapToGrid, min: { ...min, height: min.height - titleBand } }
        )
        return { ...snapped, height: snapped.height + titleBand }
      }
      const {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      } = resizeBox(
        { ...resizeStartPosition.value, ...resizeStartSize.value },
        activeCorner,
        { x: deltaX, y: deltaY },
        {
          grid: snapToGrid ? gridSize.value : 0,
          sizeRounding: 'ceil',
          minAt: (width) => ({
            width: minWidth,
            height: measureMinContentHeight(Math.max(width, minWidth))
          }),
          snap: snapBody
        }
      )

      const payload: ResizeCallbackPayload = {
        size: { width: newWidth, height: newHeight }
      }

      if (activeCorner !== 'SE') {
        payload.position = { x: newX, y: newY }
      }

      resizeCallback(payload, nodeElement)
    }

    const cleanup = () => {
      if (endActiveResize !== cleanup) return
      endActiveResize = undefined
      attempt(() => target.releasePointerCapture(event.pointerId))
      isResizing.value = false
      layoutStore.isResizingVueNodes.value = false
      resizeStartPointer.value = null
      resizeStartSize.value = null
      resizeStartPosition.value = null
      resizeSnap?.stop()

      stopShiftSync()

      stopMoveListen()
      stopUpListen()
      stopCancelListen()
    }

    const stopMoveListen = useEventListener('pointermove', handlePointerMove)
    const stopUpListen = useEventListener('pointerup', cleanup)
    const stopCancelListen = useEventListener('pointercancel', cleanup)
    endActiveResize = cleanup
  }

  return {
    startResize,
    isResizing
  }
}
