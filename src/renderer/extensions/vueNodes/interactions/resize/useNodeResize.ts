import { useEventListener } from '@vueuse/core'
import { attempt } from 'es-toolkit'

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
  rowSlack?: () => number
  snapItem?: Positionable
}

export interface ResizeCallbackPayload {
  size: Size
  position?: Point
}

/**
 * Resizes a Vue node from any corner, by pointer drag or by a keyboard step,
 * within the layout system's size constraints and grid snapping.
 */
export function useNodeResize(
  resizeCallback: (payload: ResizeCallbackPayload, element: HTMLElement) => void
) {
  const transformState = useTransformState()
  const { shouldSnap, gridSize } = useNodeSnap()
  const { trackShiftKey } = useShiftKeySync()
  const canvasStore = useCanvasStore()

  let endActiveResize: (() => void) | undefined

  function beginResize(
    corner: CompassCorners,
    {
      element: nodeElement,
      position,
      rowSlack = () => 0,
      snapItem
    }: ResizeOrigin
  ) {
    endActiveResize?.()

    const rect = nodeElement.getBoundingClientRect()
    const startScale = transformState.camera.z
    const start: Bounds = {
      ...position,
      width: rect.width / startScale,
      height: rect.height / startScale
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
      return measured / currentScale - rowSlack()
    }

    const { canvas } = canvasStore
    const resizeSnap =
      canvas && snapItem ? startResizeSnap(canvas, snapItem) : undefined

    layoutStore.isResizingVueNodes.value = true

    function resizeBy(pointer: Point, snapToGrid: boolean) {
      const scale = transformState.camera.z || 1
      const minWidth =
        parseFloat(
          nodeElement.style.getPropertyValue('--min-node-width') || '0'
        ) || MIN_NODE_WIDTH
      function snapBody(box: Bounds, min: Size): Bounds {
        if (!resizeSnap) return box
        const titleBand = box.height - removeNodeTitleHeight(box.height)
        const snapped = resizeSnap.resize(
          { ...box, height: box.height - titleBand },
          corner,
          { snapToGrid, min: { ...min, height: min.height - titleBand } }
        )
        return { ...snapped, height: snapped.height + titleBand }
      }
      const { x, y, width, height } = resizeBox(
        start,
        corner,
        { x: pointer.x / scale, y: pointer.y / scale },
        {
          grid: snapToGrid ? gridSize.value : 0,
          sizeRounding: 'ceil',
          minAt: (candidateWidth) => ({
            width: minWidth,
            height: measureMinContentHeight(Math.max(candidateWidth, minWidth))
          }),
          snap: snapBody
        }
      )
      resizeCallback(
        {
          size: { width, height },
          ...(corner !== 'SE' && { position: { x, y } })
        },
        nodeElement
      )
    }

    function end() {
      layoutStore.isResizingVueNodes.value = false
      resizeSnap?.stop()
    }

    return { resizeBy, end }
  }

  const startResize = (
    event: PointerEvent,
    corner: CompassCorners,
    origin: ResizeOrigin
  ) => {
    event.stopPropagation()

    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return

    const resize = beginResize(corner, origin)
    const startPointer: Point = { x: event.clientX, y: event.clientY }
    const stopShiftSync = trackShiftKey(event.shiftKey)
    target.setPointerCapture(event.pointerId)

    const cleanup = () => {
      if (endActiveResize !== cleanup) return
      endActiveResize = undefined
      attempt(() => target.releasePointerCapture(event.pointerId))
      resize.end()
      stopShiftSync()
      stopMoveListen()
      stopUpListen()
      stopCancelListen()
    }

    const stopMoveListen = useEventListener(
      'pointermove',
      (moveEvent: PointerEvent) =>
        resize.resizeBy(
          {
            x: moveEvent.clientX - startPointer.x,
            y: moveEvent.clientY - startPointer.y
          },
          shouldSnap(moveEvent)
        )
    )
    const stopUpListen = useEventListener('pointerup', cleanup)
    const stopCancelListen = useEventListener('pointercancel', cleanup)
    endActiveResize = cleanup
  }

  /** Resizes once from `corner` as if its handle were dragged by `delta` screen pixels, or by at least one grid cell when snapping. */
  function nudgeResize(
    event: KeyboardEvent,
    corner: CompassCorners,
    delta: Point,
    origin: ResizeOrigin
  ) {
    const snapToGrid = shouldSnap(event)
    const minStep = snapToGrid
      ? gridSize.value * (transformState.camera.z || 1)
      : 0
    const step = (pixels: number) =>
      Math.sign(pixels) * Math.max(Math.abs(pixels), minStep)
    const resize = beginResize(corner, origin)
    resize.resizeBy({ x: step(delta.x), y: step(delta.y) }, snapToGrid)
    resize.end()
  }

  return { startResize, nudgeResize }
}
