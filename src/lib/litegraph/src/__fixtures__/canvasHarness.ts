import type { Rect } from '@/lib/litegraph/src/interfaces'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  LGraphCanvas,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  registerCanvasKeybindings,
  unregisterCanvasKeybindings
} from '@/renderer/core/canvas/canvasKeybindings'
import { createTestCanvasElement } from '@/utils/__tests__/canvasTestUtils'

export type Modifiers = Partial<
  Pick<MouseEventInit, 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>
>

export type PointerEventOptions = Modifiers & {
  button?: number
  buttons?: number
  pointerId?: number
  timeStamp?: number
}

export type PointerEventType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointercancel'

export function createCanvas(graph: LGraph): LGraphCanvas {
  const canvasElement = createTestCanvasElement({ cssSize: [800, 600] })
  document.body.append(canvasElement)
  return new LGraphCanvas(canvasElement, graph, { skip_render: true })
}

export function addNode(graph: LGraph, title: string, x: number, y: number) {
  const node = new LGraphNode(title)
  node.pos = [x, y]
  node.size = [100, 60]
  node.updateArea()
  graph.add(node)
  return node
}

export function addGroup(graph: LGraph, title: string, bounds: Rect) {
  const group = new LGraphGroup(title)
  group._bounding.set(bounds)
  graph.add(group)
  return group
}

export function pointerEvent(
  type: PointerEventType,
  x: number,
  y: number,
  {
    button = 0,
    buttons,
    pointerId = 1,
    timeStamp,
    ...modifiers
  }: PointerEventOptions = {}
): CanvasPointerEvent {
  const pressed = type === 'pointerdown' || type === 'pointermove'
  const event = new PointerEvent(type, {
    button,
    buttons: buttons ?? (pressed ? (button === 2 ? 2 : 1) : 0),
    clientX: x,
    clientY: y,
    isPrimary: true,
    pointerId,
    ...modifiers
  })
  if (timeStamp !== undefined) {
    Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  }
  return Object.assign(event, {
    canvasX: x,
    canvasY: y,
    deltaX: 0,
    deltaY: 0,
    safeOffsetX: x,
    safeOffsetY: y
  })
}

export function loseCapture(element: Element, pointerId = 1): void {
  element.releasePointerCapture(pointerId)
  element.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId }))
}

/**
 * Routes keyboard input to a canvas the way the app does: the canvas sits
 * focused in `#graph-canvas-container`, its shortcuts are registered and the
 * keybinding dispatcher listens on the window.
 */
export function attachKeyboard(canvas: LGraphCanvas) {
  const element = canvas.canvas
  const container = document.createElement('div')
  container.id = 'graph-canvas-container'
  document.body.append(container)
  container.append(element)
  element.tabIndex = 0
  element.focus()
  useSettingStore().settingValues['Comfy.Keybinding.CapturePhase'] = true
  registerCanvasKeybindings(canvas, () => canvas['_autoPan'])
  const uninstall = useKeybindingService().install()

  function send(type: 'keydown' | 'keyup', key: string) {
    const event = new KeyboardEvent(type, {
      key,
      bubbles: true,
      cancelable: true
    })
    element.dispatchEvent(event)
    return event
  }

  return {
    press: (key: string) => send('keydown', key),
    release: (key: string) => send('keyup', key),
    dispose: () => {
      uninstall()
      unregisterCanvasKeybindings(canvas)
      container.remove()
    }
  }
}

export function selectedTitles(canvas: LGraphCanvas): string[] {
  return [...canvas.selectedItems]
    .map((item) => ('title' in item ? String(item.title) : String(item)))
    .sort()
}
