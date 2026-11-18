import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { callListener } from '@/platform/nodeApi/shared/listeners'
import type { GraphOverlayViewport } from '@/platform/nodeApi/v4/types'
import {
  isFiniteNumber,
  packObject
} from '@/platform/nodeApi/v4/utilities/packArguments'

import { routeOverlayInput } from './overlayInput'
import type { OverlayInputCallbacks, OverlayState } from './overlayInput'

/** A pack's overlay callbacks. */
export interface OverlayCallbacks extends OverlayInputCallbacks {
  readonly draw: (
    context: CanvasRenderingContext2D,
    size: readonly [number, number],
    viewport: GraphOverlayViewport
  ) => unknown
}

/** An overlay's canvas element, on the graph view it is attached to. */
export interface OverlaySurface {
  attach(canvas: LGraphCanvas): void
  detach(): void
  draw(): void
  requestDraw(): void
  show(visible: boolean): void
}

export function createOverlaySurface(
  member: string,
  element: HTMLCanvasElement,
  callbacks: OverlayCallbacks,
  state: OverlayState
): OverlaySurface {
  let attached: { canvas: LGraphCanvas; release(): void } | undefined
  let cancelDraw: (() => void) | undefined

  function draw() {
    cancelDraw?.()
    cancelDraw = undefined
    if (attached && state.visible) {
      paint(member, element, attached.canvas, callbacks.draw)
    }
  }

  function requestDraw() {
    if (!attached || cancelDraw) return
    cancelDraw = onCanvasFrame(attached.canvas, 'present', draw)
  }

  function detach() {
    cancelDraw?.()
    cancelDraw = undefined
    attached?.release()
    attached = undefined
    element.remove()
  }

  function attach(canvas: LGraphCanvas) {
    const view = canvas.canvas.parentElement
    if (attached?.canvas === canvas || !view) return
    detach()
    view.insertBefore(
      element,
      view.querySelector(':scope > [data-viewport-panel]')
    )
    const release = routeOverlayInput(
      element,
      view,
      canvas,
      member,
      callbacks,
      state
    )
    attached = { canvas, release }
    requestDraw()
  }

  return {
    attach,
    detach,
    draw,
    requestDraw,
    show(visible) {
      element.hidden = !visible
      if (visible) requestDraw()
    }
  }
}

function paint(
  member: string,
  element: HTMLCanvasElement,
  canvas: LGraphCanvas,
  draw: OverlayCallbacks['draw']
): void {
  const { width, height } = canvas.canvas
  if (element.width !== width) element.width = width
  if (element.height !== height) element.height = height
  const context = element.getContext('2d')
  if (!context) return
  const { dpr } = canvas
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, width, height)
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  const size = Object.freeze([width / dpr, height / dpr] as const)
  const viewport = viewportOf(canvas)
  context.save()
  callListener(member, () => draw(context, size, viewport))
  context.restore()
}

function viewportOf(canvas: LGraphCanvas): GraphOverlayViewport {
  const member = 'graphToViewport'
  return Object.freeze({
    scale: canvas.ds.scale,
    graphToViewport(point: unknown) {
      const fields = packObject(member, 'a point', point)
      const [x, y] = canvas.ds.convertOffsetToCanvas([
        fields.required('x', isFiniteNumber, 'a finite number'),
        fields.required('y', isFiniteNumber, 'a finite number')
      ])
      return Object.freeze({ x, y })
    }
  })
}
