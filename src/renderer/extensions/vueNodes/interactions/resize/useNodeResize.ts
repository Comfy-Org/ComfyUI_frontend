import { useEventListener } from '@vueuse/core'
import { attempt } from 'es-toolkit'
import { ref } from 'vue'

import type {
  CompassCorners,
  Point2D as Point,
  Size2D as Size
} from '@comfyorg/shared-frontend-utils/geometry'
import type { Positionable } from '@comfyorg/graph-model/interfaces'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  clampToMinimum,
  resizeFromCorner
} from '@/lib/litegraph/src/canvas/cornerResize'
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

  const startResize = (
    event: PointerEvent,
    corner: CompassCorners,
    { element: nodeElement, position, snapItem }: ResizeOrigin
  ) => {
    event.stopPropagation()

    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return

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
      const resized = resizeFromCorner(
        { ...resizeStartPosition.value, ...resizeStartSize.value },
        activeCorner,
        deltaX,
        deltaY,
        snapToGrid ? gridSize.value : 0,
        'ceil'
      )

      const titleBand = resized.height - removeNodeTitleHeight(resized.height)
      const body = { ...resized, height: resized.height - titleBand }
      const minWidth =
        parseFloat(nodeElement.style.getPropertyValue('min-width') || '0') ||
        MIN_NODE_WIDTH
      const rawWidth = Math.max(body.width, minWidth)
      const rawMinHeight = measureMinContentHeight(rawWidth)
      const snapped =
        resizeSnap?.resize(body, activeCorner, {
          snapToGrid,
          min: { width: minWidth, height: rawMinHeight - titleBand }
        }) ?? body
      const withTitle = { ...snapped, height: snapped.height + titleBand }

      const width = Math.max(withTitle.width, minWidth)
      const {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      } = clampToMinimum(
        withTitle,
        activeCorner,
        minWidth,
        width === rawWidth ? rawMinHeight : measureMinContentHeight(width)
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
      if (!isResizing.value) return
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

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (isResizing.value) {
        attempt(() => target.releasePointerCapture(upEvent.pointerId))
        cleanup()
      }
    }

    const stopMoveListen = useEventListener('pointermove', handlePointerMove)
    const stopUpListen = useEventListener('pointerup', handlePointerUp)
    const stopCancelListen = useEventListener('pointercancel', cleanup)
  }

  return {
    startResize,
    isResizing
  }
}
