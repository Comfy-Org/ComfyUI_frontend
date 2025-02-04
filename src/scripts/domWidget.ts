// @ts-strict-ignore
import { LGraphCanvas, LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import type { Vector4 } from '@comfyorg/litegraph'
import {
  ICustomWidget,
  IWidgetOptions
} from '@comfyorg/litegraph/dist/types/widgets'

import { useSettingStore } from '@/stores/settingStore'

import { ANIM_PREVIEW_WIDGET, app } from './app'

const SIZE = Symbol()

interface Rect {
  height: number
  width: number
  x: number
  y: number
}

export interface DOMWidget<T extends HTMLElement, V extends object | string>
  extends ICustomWidget<T> {
  // All unrecognized types will be treated the same way as 'custom' in litegraph internally.
  type: 'custom'
  name: string
  computedHeight?: number
  element?: T
  options: DOMWidgetOptions<T, V>
  value: V
  y?: number
  callback?: (value: V) => void
  /**
   * Draw the widget on the canvas.
   */
  draw?: (
    ctx: CanvasRenderingContext2D,
    node: LGraphNode,
    widgetWidth: number,
    y: number,
    widgetHeight: number
  ) => void
  /**
   * TODO(huchenlei): Investigate when is this callback fired. `onRemove` is
   * on litegraph's IBaseWidget definition, but not called in litegraph.
   * Currently only called in widgetInputs.ts.
   */
  onRemove?: () => void
}

export interface DOMWidgetOptions<
  T extends HTMLElement,
  V extends object | string
> extends IWidgetOptions {
  hideOnZoom?: boolean
  selectOn?: string[]
  onHide?: (widget: DOMWidget<T, V>) => void
  getValue?: () => V
  setValue?: (value: V) => void
  getMinHeight?: () => number
  getMaxHeight?: () => number
  getHeight?: () => string | number
  onDraw?: (widget: DOMWidget<T, V>) => void
  beforeResize?: (this: DOMWidget<T, V>, node: LGraphNode) => void
  afterResize?: (this: DOMWidget<T, V>, node: LGraphNode) => void
}

function intersect(a: Rect, b: Rect): Vector4 | null {
  const x = Math.max(a.x, b.x)
  const num1 = Math.min(a.x + a.width, b.x + b.width)
  const y = Math.max(a.y, b.y)
  const num2 = Math.min(a.y + a.height, b.y + b.height)
  if (num1 >= x && num2 >= y) return [x, y, num1 - x, num2 - y]
  else return null
}

function getClipPath(
  node: LGraphNode,
  element: HTMLElement,
  canvasRect: DOMRect
): string {
  const selectedNode: LGraphNode = Object.values(
    app.canvas.selected_nodes
  )[0] as LGraphNode
  if (selectedNode && selectedNode !== node) {
    const elRect = element.getBoundingClientRect()
    const MARGIN = 4
    const { offset, scale } = app.canvas.ds
    const { renderArea } = selectedNode

    // Get intersection in browser space
    const intersection = intersect(
      {
        x: elRect.left - canvasRect.left,
        y: elRect.top - canvasRect.top,
        width: elRect.width,
        height: elRect.height
      },
      {
        x: (renderArea[0] + offset[0] - MARGIN) * scale,
        y: (renderArea[1] + offset[1] - MARGIN) * scale,
        width: (renderArea[2] + 2 * MARGIN) * scale,
        height: (renderArea[3] + 2 * MARGIN) * scale
      }
    )

    if (!intersection) {
      return ''
    }

    // Convert intersection to canvas scale (element has scale transform)
    const clipX =
      (intersection[0] - elRect.left + canvasRect.left) / scale + 'px'
    const clipY = (intersection[1] - elRect.top + canvasRect.top) / scale + 'px'
    const clipWidth = intersection[2] / scale + 'px'
    const clipHeight = intersection[3] / scale + 'px'
    const path = `polygon(0% 0%, 0% 100%, ${clipX} 100%, ${clipX} ${clipY}, calc(${clipX} + ${clipWidth}) ${clipY}, calc(${clipX} + ${clipWidth}) calc(${clipY} + ${clipHeight}), ${clipX} calc(${clipY} + ${clipHeight}), ${clipX} 100%, 100% 100%, 100% 0%)`
    return path
  }
  return ''
}

function computeSize(size: [number, number]): void {
  if (this.widgets?.[0]?.last_y == null) return

  let y = this.widgets[0].last_y
  let freeSpace = size[1] - y

  let widgetHeight = 0
  let dom = []
  for (const w of this.widgets) {
    if (w.type === 'converted-widget') {
      // Ignore
      delete w.computedHeight
    } else if (w.computeSize) {
      widgetHeight += w.computeSize()[1] + 4
    } else if (w.element) {
      // Extract DOM widget size info
      const styles = getComputedStyle(w.element)
      let minHeight =
        w.options.getMinHeight?.() ??
        parseInt(styles.getPropertyValue('--comfy-widget-min-height'))
      let maxHeight =
        w.options.getMaxHeight?.() ??
        parseInt(styles.getPropertyValue('--comfy-widget-max-height'))

      let prefHeight =
        w.options.getHeight?.() ??
        styles.getPropertyValue('--comfy-widget-height')
      if (prefHeight.endsWith?.('%')) {
        prefHeight =
          size[1] *
          (parseFloat(prefHeight.substring(0, prefHeight.length - 1)) / 100)
      } else {
        prefHeight = parseInt(prefHeight)
        if (isNaN(minHeight)) {
          minHeight = prefHeight
        }
      }
      if (isNaN(minHeight)) {
        minHeight = 50
      }
      if (!isNaN(maxHeight)) {
        if (!isNaN(prefHeight)) {
          prefHeight = Math.min(prefHeight, maxHeight)
        } else {
          prefHeight = maxHeight
        }
      }
      dom.push({
        minHeight,
        prefHeight,
        w
      })
    } else {
      widgetHeight += LiteGraph.NODE_WIDGET_HEIGHT + 4
    }
  }

  freeSpace -= widgetHeight

  // Calculate sizes with all widgets at their min height
  const prefGrow = [] // Nodes that want to grow to their prefd size
  const canGrow = [] // Nodes that can grow to auto size
  let growBy = 0
  for (const d of dom) {
    freeSpace -= d.minHeight
    if (isNaN(d.prefHeight)) {
      canGrow.push(d)
      d.w.computedHeight = d.minHeight
    } else {
      const diff = d.prefHeight - d.minHeight
      if (diff > 0) {
        prefGrow.push(d)
        growBy += diff
        d.diff = diff
      } else {
        d.w.computedHeight = d.minHeight
      }
    }
  }

  if (this.imgs && !this.widgets.find((w) => w.name === ANIM_PREVIEW_WIDGET)) {
    // Allocate space for image
    freeSpace -= 220
  }

  this.freeWidgetSpace = freeSpace

  if (freeSpace < 0) {
    // Not enough space for all widgets so we need to grow
    size[1] -= freeSpace
    this.graph.setDirtyCanvas(true)
  } else {
    // Share the space between each
    const growDiff = freeSpace - growBy
    if (growDiff > 0) {
      // All pref sizes can be fulfilled
      freeSpace = growDiff
      for (const d of prefGrow) {
        d.w.computedHeight = d.prefHeight
      }
    } else {
      // We need to grow evenly
      const shared = -growDiff / prefGrow.length
      for (const d of prefGrow) {
        d.w.computedHeight = d.prefHeight - shared
      }
      freeSpace = 0
    }

    if (freeSpace > 0 && canGrow.length) {
      // Grow any that are auto height
      const shared = freeSpace / canGrow.length
      for (const d of canGrow) {
        d.w.computedHeight += shared
      }
    }
  }

  // Position each of the widgets
  for (const w of this.widgets) {
    w.y = y
    if (w.computedHeight) {
      y += w.computedHeight
    } else if (w.computeSize) {
      y += w.computeSize()[1] + 4
    } else {
      y += LiteGraph.NODE_WIDGET_HEIGHT + 4
    }
  }
}

// Override the compute visible nodes function to allow us to hide/show DOM elements when the node goes offscreen
const elementWidgets = new Set()
//@ts-ignore
const computeVisibleNodes = LGraphCanvas.prototype.computeVisibleNodes
//@ts-ignore
LGraphCanvas.prototype.computeVisibleNodes = function (): LGraphNode[] {
  const visibleNodes = computeVisibleNodes.apply(this, arguments)

  for (const node of app.graph.nodes) {
    if (elementWidgets.has(node)) {
      const hidden = visibleNodes.indexOf(node) === -1
      for (const w of node.widgets) {
        if (w.element) {
          w.element.dataset.isInVisibleNodes = hidden ? 'false' : 'true'
          const shouldOtherwiseHide = w.element.dataset.shouldHide === 'true'
          const isCollapsed = w.element.dataset.collapsed === 'true'
          const wasHidden = w.element.hidden
          const actualHidden = hidden || shouldOtherwiseHide || isCollapsed
          w.element.hidden = actualHidden
          w.element.style.display = actualHidden ? 'none' : null
          if (actualHidden && !wasHidden) {
            w.options.onHide?.(w as DOMWidget<HTMLElement, object>)
          }
        }
      }
    }
  }

  return visibleNodes
}

LGraphNode.prototype.addDOMWidget = function <
  T extends HTMLElement,
  V extends object | string
>(
  name: string,
  type: string,
  element: T,
  options: DOMWidgetOptions<T, V> = {}
): DOMWidget<T, V> {
  options = { hideOnZoom: true, selectOn: ['focus', 'click'], ...options }

  if (!element.parentElement) {
    app.canvasContainer.append(element)
  }
  element.hidden = true
  element.style.display = 'none'

  let mouseDownHandler
  if (element.blur) {
    mouseDownHandler = (event) => {
      if (!element.contains(event.target)) {
        element.blur()
      }
    }
    document.addEventListener('mousedown', mouseDownHandler)
  }

  const { nodeData } = this.constructor
  const tooltip = (nodeData?.input.required?.[name] ??
    nodeData?.input.optional?.[name])?.[1]?.tooltip
  if (tooltip && !element.title) {
    element.title = tooltip
  }

  const widget: DOMWidget<T, V> = {
    // @ts-expect-error All unrecognized types will be treated the same way as 'custom'
    // in litegraph internally.
    type,
    name,
    get value(): V {
      return options.getValue?.() ?? undefined
    },
    set value(v: V) {
      options.setValue?.(v)
      widget.callback?.(widget.value)
    },
    draw: function (
      ctx: CanvasRenderingContext2D,
      node: LGraphNode,
      widgetWidth: number,
      y: number,
      widgetHeight: number
    ) {
      if (widget.computedHeight == null) {
        computeSize.call(node, node.size)
      }

      const { offset, scale } = app.canvas.ds

      const hidden =
        (!!options.hideOnZoom && app.canvas.low_quality) ||
        widget.computedHeight <= 0 ||
        // @ts-expect-error Used by widgetInputs.ts
        widget.type === 'converted-widget' ||
        // @ts-expect-error Used by groupNode.ts
        widget.type === 'hidden'

      element.dataset.shouldHide = hidden ? 'true' : 'false'
      const isInVisibleNodes = element.dataset.isInVisibleNodes === 'true'
      const isCollapsed = element.dataset.collapsed === 'true'
      const actualHidden = hidden || !isInVisibleNodes || isCollapsed
      const wasHidden = element.hidden
      element.hidden = actualHidden
      element.style.display = actualHidden ? 'none' : null
      if (actualHidden && !wasHidden) {
        widget.options.onHide?.(widget)
      }
      if (actualHidden) {
        return
      }

      const elRect = ctx.canvas.getBoundingClientRect()
      const margin = 10
      const top = node.pos[0] + offset[0] + margin
      const left = node.pos[1] + offset[1] + margin + y

      Object.assign(element.style, {
        transformOrigin: '0 0',
        transform: `scale(${scale})`,
        left: `${top * scale}px`,
        top: `${left * scale}px`,
        width: `${widgetWidth - margin * 2}px`,
        height: `${(widget.computedHeight ?? 50) - margin * 2}px`,
        position: 'absolute',
        zIndex: app.graph.nodes.indexOf(node),
        pointerEvents: app.canvas.read_only ? 'none' : 'auto'
      })

      if (useSettingStore().get('Comfy.DOMClippingEnabled')) {
        element.style.clipPath = getClipPath(node, element, elRect)
        element.style.willChange = 'clip-path'
      }

      this.options.onDraw?.(widget)
    },
    element,
    options,
    onRemove() {
      if (mouseDownHandler) {
        document.removeEventListener('mousedown', mouseDownHandler)
      }
      element.remove()
    }
  }

  for (const evt of options.selectOn) {
    element.addEventListener(evt, () => {
      app.canvas.selectNode(this)
      app.canvas.bringToFront(this)
    })
  }

  this.addCustomWidget(widget)
  elementWidgets.add(this)

  const collapse = this.collapse
  this.collapse = function () {
    collapse.apply(this, arguments)
    if (this.flags?.collapsed) {
      element.hidden = true
      element.style.display = 'none'
    }
    element.dataset.collapsed = this.flags?.collapsed ? 'true' : 'false'
  }

  const { onConfigure } = this
  this.onConfigure = function () {
    onConfigure?.apply(this, arguments)
    element.dataset.collapsed = this.flags?.collapsed ? 'true' : 'false'
  }

  const onRemoved = this.onRemoved
  this.onRemoved = function () {
    element.remove()
    elementWidgets.delete(this)
    onRemoved?.apply(this, arguments)
  }

  if (!this[SIZE]) {
    this[SIZE] = true
    const onResize = this.onResize
    this.onResize = function (size) {
      options.beforeResize?.call(widget, this)
      computeSize.call(this, size)
      onResize?.apply(this, arguments)
      options.afterResize?.call(widget, this)
    }
  }

  return widget
}
