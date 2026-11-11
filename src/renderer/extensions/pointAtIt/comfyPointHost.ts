import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import { useFocusNode } from '@/composables/canvas/useFocusNode'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { visibleCanvasViewport } from '@/composables/canvas/visibleCanvasViewport'
import { resolveNodeDefSlotText, resolveNodeDefText } from '@/i18n'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { collectAllNodes, getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'

import type { Rect } from './core/geometry'
import type {
  HostNode,
  HostSetting,
  PointHost,
  TargetReading
} from './core/pointHost'
import type {
  SettingAddress,
  SettingValue,
  TargetAddress
} from './core/targetAddress'

const NODE_ELEMENTS = '[data-testid="transform-pane"] [data-node-id]'
const RUN_BUTTON = '[data-testid="queue-button"]'
const CLASSIC_ROW_MARGIN = 6
const EMPTY_VIEWPORT: Rect = { x: 0, y: 0, width: 0, height: 0 }

type GraphRect = readonly [x: number, y: number, width: number, height: number]

function elementRect(element: Element): Rect | null {
  const { left, top, width, height } = element.getBoundingClientRect()
  return width > 0 && height > 0 ? { x: left, y: top, width, height } : null
}

function graphRectToScreen(canvas: LGraphCanvas, rect: GraphRect): Rect {
  const bounds = canvas.canvas.getBoundingClientRect()
  const { offset, scale } = canvas.ds
  return {
    x: (rect[0] + offset[0]) * scale + bounds.left,
    y: (rect[1] + offset[1]) * scale + bounds.top,
    width: rect[2] * scale,
    height: rect[3] * scale
  }
}

function locatorIdOf(node: LGraphNode): NodeLocatorId {
  const graph = node.graph
  return createNodeLocatorId(
    graph && !graph.isRootGraph ? graph.id : null,
    node.id
  )
}

function drawnNodeElements(): Map<string, Element> {
  return new Map(
    [...document.querySelectorAll(NODE_ELEMENTS)].map((element) => [
      element.getAttribute('data-node-id') ?? '',
      element
    ])
  )
}

function nodeElementOf(node: LGraphNode): Element | null {
  return document.querySelector(
    `[data-testid="transform-pane"] [data-node-id="${CSS.escape(String(node.id))}"]`
  )
}

function nodeRect(
  node: LGraphNode,
  canvas: LGraphCanvas,
  element: Element | null | undefined
): Rect | null {
  if (node.graph !== canvas.graph) return null
  if (element) return elementRect(element)
  const [x, y, width, height] = node.boundingRect
  return graphRectToScreen(canvas, [x, y, width, height])
}

function classicRowRect(
  node: LGraphNode,
  widget: IBaseWidget,
  canvas: LGraphCanvas
): Rect | null {
  if (LiteGraph.vueNodesMode || node.collapsed) return null
  if (widget.last_y === undefined) return null
  return graphRectToScreen(canvas, [
    node.pos[0] + CLASSIC_ROW_MARGIN,
    node.pos[1] + widget.last_y,
    node.size[0] - CLASSIC_ROW_MARGIN * 2,
    widget.computedHeight ?? LiteGraph.NODE_WIDGET_HEIGHT
  ])
}

function settingRect(
  node: LGraphNode,
  widget: IBaseWidget,
  canvas: LGraphCanvas,
  element: Element | null | undefined
): Rect | null {
  if (node.graph !== canvas.graph) return null
  if (!element) return classicRowRect(node, widget, canvas)
  const row = element.querySelector(
    `[data-widget-name="${CSS.escape(widget.name)}"]`
  )
  return row ? elementRect(row) : null
}

function settingValue(widget: IBaseWidget): SettingValue | undefined {
  const { value } = widget
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? value
    : undefined
}

function nodeDefOf(type: string): ComfyNodeDefImpl | undefined {
  return useNodeDefStore().nodeDefsByName[type]
}

function settingDescription(node: LGraphNode, widget: IBaseWidget): string {
  const type = node.type
  const backendTooltip = nodeDefOf(type)?.inputs[widget.name]?.tooltip
  return (
    widget.tooltip ||
    resolveNodeDefSlotText('tooltip', type, widget.name, backendTooltip)
  )
}

function nodeDescription(node: LGraphNode): string {
  const type = node.type
  const backend = nodeDefOf(type)?.description
  return resolveNodeDefText('description', type, backend || undefined)
}

function findWidget(node: LGraphNode, name: string): IBaseWidget | undefined {
  return node.widgets?.find((widget) => widget.name === name)
}

function visibleWidgets(node: LGraphNode): IBaseWidget[] {
  return (node.widgets ?? []).filter((widget) => !widget.hidden)
}

/** The app side of the layer: the one file that imports app modules. */
export function createComfyPointHost(): PointHost {
  const canvasStore = useCanvasStore()
  const { focusNodeInstance } = useFocusNode()
  const { forwardEventToCanvas } = useCanvasInteractions()

  function hostSetting(
    node: LGraphNode,
    widget: IBaseWidget,
    canvas: LGraphCanvas | null,
    element: Element | undefined
  ): HostSetting {
    return {
      name: widget.name,
      label: widget.label ?? widget.name,
      description: settingDescription(node, widget),
      value: settingValue(widget),
      rect: canvas ? settingRect(node, widget, canvas, element) : null
    }
  }

  function readNodes(): HostNode[] {
    const { canvas } = canvasStore
    const elements = drawnNodeElements()
    return collectAllNodes(app.rootGraph).map((node) => {
      const element =
        canvas && node.graph === canvas.graph
          ? elements.get(String(node.id))
          : undefined
      return {
        id: locatorIdOf(node),
        type: node.type,
        title: node.title,
        description: nodeDescription(node),
        rect: canvas ? nodeRect(node, canvas, element) : null,
        settings: visibleWidgets(node).map((widget) =>
          hostSetting(node, widget, canvas, element)
        )
      }
    })
  }

  function readSelection(): NodeLocatorId[] {
    return canvasStore.selectedItems.filter(isLGraphNode).map(locatorIdOf)
  }

  function readTarget(target: TargetAddress): TargetReading | null {
    if (target.kind === 'control') {
      const button = document.querySelector(RUN_BUTTON)
      return { rect: button ? elementRect(button) : null, value: undefined }
    }
    const node = getNodeByLocatorId(app.rootGraph, target.nodeId)
    if (!node) return null
    const { canvas } = canvasStore
    const element = nodeElementOf(node)
    if (target.kind === 'node')
      return {
        rect: canvas ? nodeRect(node, canvas, element) : null,
        value: undefined
      }
    const widget = findWidget(node, target.setting)
    if (!widget) return null
    return {
      rect: canvas ? settingRect(node, widget, canvas, element) : null,
      value: settingValue(widget)
    }
  }

  function viewport(): Rect {
    const { canvas } = canvasStore
    if (!canvas) return EMPTY_VIEWPORT
    const bounds = canvas.canvas.getBoundingClientRect()
    const [, , width, height] = visibleCanvasViewport(canvas)
    return { x: bounds.left, y: bounds.top, width, height }
  }

  async function reveal(target: TargetAddress): Promise<void> {
    if (target.kind === 'control') return
    const node = getNodeByLocatorId(app.rootGraph, target.nodeId)
    if (node) await focusNodeInstance(node)
  }

  function write(target: SettingAddress, value: SettingValue): boolean {
    const node = getNodeByLocatorId(app.rootGraph, target.nodeId)
    const widget = node && findWidget(node, target.setting)
    if (!node || !widget || widget.type === 'button') return false
    const { canvas } = canvasStore
    if (widget instanceof BaseWidget) {
      widget.setValue(value, { node, canvas: canvas ?? undefined })
    } else {
      const previous = widget.value
      widget.value = value
      widget.callback?.(value, canvas ?? undefined, node)
      node.onWidgetChanged?.(widget.name, value, previous, widget)
    }
    canvas?.setDirty(true, true)
    return widget.value === value
  }

  function onRunQueued(listener: () => void): () => void {
    api.addEventListener('promptQueued', listener)
    return () => api.removeEventListener('promptQueued', listener)
  }

  return {
    readNodes,
    readSelection,
    readTarget,
    viewport,
    reveal,
    write,
    onRunQueued,
    forwardWheel: forwardEventToCanvas
  }
}
