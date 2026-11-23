import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { CanvasSource } from '@/platform/nodeApi/shared/canvasSource'
import { checkedPoint } from '@/platform/nodeApi/v4/edit/checkedArguments'
import { selectedNodes } from '@/platform/nodeApi/v4/events/selection'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { Bounds, GraphHandle } from '@/platform/nodeApi/v4/types'

type GraphView = Pick<
  GraphHandle,
  'selection' | 'select' | 'centerOn' | 'pointerPosition' | 'setZoom' | 'panBy'
>

/** What a pack does to the view of the graph on screen. None of it edits the graph. */
export function createGraphView(
  nodes: NodeHandles,
  visible: () => LGraph | undefined,
  source: () => CanvasSource | undefined
): GraphView {
  const shownCanvas = () => source()?.canvas() ?? undefined

  function onScreen(member: string, handle: unknown): LGraphNode | undefined {
    const locate = nodes.locator(handle)
    if (!locate) throw invalidArgument(member, 'a node handle', handle)
    const live = locate()
    return live && live.graph === visible() ? live.node : undefined
  }

  return {
    selection: () => selectedNodes(nodes, visible()),
    select(handles) {
      if (!Array.isArray(handles)) {
        throw invalidArgument('select', 'a list of node handles', handles)
      }
      const selected = handles.map((handle) => onScreen('select', handle))
      const canvas = shownCanvas()
      if (!canvas || !selected.every((node) => node !== undefined)) return false
      canvas.selectItems(selected)
      return true
    },
    centerOn(handle) {
      const node = onScreen('centerOn', handle)
      const canvas = shownCanvas()
      if (!node || !canvas) return false
      canvas.centerOnNode(node)
      viewChanged(canvas)
      return true
    },
    pointerPosition() {
      const canvas = shownCanvas()
      if (!canvas) return undefined
      const [x, y] = canvas.graph_mouse
      return Object.freeze({ x, y })
    },
    setZoom(scale) {
      if (!isFiniteNumber(scale) || scale <= 0) {
        throw invalidArgument('setZoom', 'a positive scale', scale)
      }
      const canvas = shownCanvas()
      if (!canvas) return
      const { x, y, width, height } = canvas.ds.element.getBoundingClientRect()
      canvas.ds.changeScale(scale, [x + width / 2, y + height / 2])
      viewChanged(canvas)
    },
    panBy(delta) {
      const [x, y] = checkedPoint('panBy', 'delta', delta)
      const canvas = shownCanvas()
      if (!canvas) return
      canvas.ds.mouseDrag(x, y)
      viewChanged(canvas)
    }
  }
}

/** Pans the canvas on screen so `area`, in graph space, is in its middle. */
export function centerOnArea(
  source: () => CanvasSource | undefined,
  graph: LGraph,
  { x, y, width, height }: Bounds
): boolean {
  const canvas = source()?.canvas()
  if (!canvas || canvas.graph !== graph) return false
  const { ds, dpr } = canvas
  ds.offset[0] = -x - width / 2 + canvas.canvas.width / (2 * ds.scale * dpr)
  ds.offset[1] = -y - height / 2 + canvas.canvas.height / (2 * ds.scale * dpr)
  viewChanged(canvas)
  return true
}

function viewChanged(canvas: LGraphCanvas): void {
  canvas.setDirty(true, true)
  canvas.ds.computeVisibleArea(canvas.viewport)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
