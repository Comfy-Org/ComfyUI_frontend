import { LGraphCanvas, LGraphNode } from '@comfyorg/litegraph'
import type { Vector4 } from '@comfyorg/litegraph'
import type { ISerialisedNode } from '@comfyorg/litegraph/dist/types/serialisation'
import type {
  ICustomWidget,
  IWidgetOptions
} from '@comfyorg/litegraph/dist/types/widgets'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { app } from '@/scripts/app'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useSettingStore } from '@/stores/settingStore'
import { generateRandomSuffix } from '@/utils/formatUtil'

interface Rect {
  height: number
  width: number
  x: number
  y: number
}

export interface DOMWidget<T extends HTMLElement, V extends object | string>
  extends ICustomWidget<T> {
  // ICustomWidget properties
  type: 'custom'
  element: T
  options: DOMWidgetOptions<T, V>
  value: V
  /**
   * @deprecated Legacy property used by some extensions for customtext
   * (textarea) widgets. Use `element` instead as it provides the same
   * functionality and works for all DOMWidget types.
   */
  inputEl?: T
  callback?: (value: V) => void
  // DOMWidget properties
  /** The unique ID of the widget. */
  id: string
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
  /**
   * @deprecated Use `afterResize` instead. This callback is a legacy API
   * that fires before resize happens, but it is no longer supported. Now it
   * fires after resize happens.
   * The resize logic has been upstreamed to litegraph in
   * https://github.com/Comfy-Org/ComfyUI_frontend/pull/2557
   */
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
    app.canvas.selected_nodes ?? {}
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

// Override the compute visible nodes function to allow us to hide/show DOM elements when the node goes offscreen
const elementWidgets = new Set<LGraphNode>()
const computeVisibleNodes = LGraphCanvas.prototype.computeVisibleNodes
LGraphCanvas.prototype.computeVisibleNodes = function (
  nodes?: LGraphNode[],
  out?: LGraphNode[]
): LGraphNode[] {
  const visibleNodes = computeVisibleNodes.call(this, nodes, out)

  for (const node of app.graph.nodes) {
    if (elementWidgets.has(node)) {
      const hidden = visibleNodes.indexOf(node) === -1
      for (const w of node.widgets ?? []) {
        if (w.element) {
          w.element.dataset.isInVisibleNodes = hidden ? 'false' : 'true'
          const shouldOtherwiseHide = w.element.dataset.shouldHide === 'true'
          const wasHidden = w.element.hidden
          const actualHidden = hidden || shouldOtherwiseHide || node.collapsed
          w.element.hidden = actualHidden
          w.element.style.display = actualHidden ? 'none' : ''
          if (actualHidden && !wasHidden) {
            w.options.onHide?.(w as DOMWidget<HTMLElement, object>)
          }
        }
      }
    }
  }

  return visibleNodes
}

export class DOMWidgetImpl<T extends HTMLElement, V extends object | string>
  implements DOMWidget<T, V>
{
  readonly type: 'custom'
  readonly name: string
  readonly element: T
  readonly options: DOMWidgetOptions<T, V>
  computedHeight?: number
  callback?: (value: V) => void

  readonly id: string
  mouseDownHandler?: (event: MouseEvent) => void

  constructor(obj: {
    id: string
    name: string
    type: string
    element: T
    options: DOMWidgetOptions<T, V>
  }) {
    // @ts-expect-error custom widget type
    this.type = obj.type
    this.name = obj.name
    this.element = obj.element
    this.options = obj.options

    this.id = obj.id

    if (this.element.blur) {
      this.mouseDownHandler = (event) => {
        if (!this.element.contains(event.target as HTMLElement)) {
          this.element.blur()
        }
      }
      document.addEventListener('mousedown', this.mouseDownHandler)
    }
  }

  get value(): V {
    return this.options.getValue?.() ?? ('' as V)
  }

  set value(v: V) {
    this.options.setValue?.(v)
    this.callback?.(this.value)
  }

  /** Extract DOM widget size info */
  computeLayoutSize(node: LGraphNode) {
    // @ts-expect-error custom widget type
    if (this.type === 'hidden') {
      return {
        minHeight: 0,
        maxHeight: 0,
        minWidth: 0
      }
    }

    const styles = getComputedStyle(this.element)
    let minHeight =
      this.options.getMinHeight?.() ??
      parseInt(styles.getPropertyValue('--comfy-widget-min-height'))
    let maxHeight =
      this.options.getMaxHeight?.() ??
      parseInt(styles.getPropertyValue('--comfy-widget-max-height'))

    let prefHeight: string | number =
      this.options.getHeight?.() ??
      styles.getPropertyValue('--comfy-widget-height')

    if (typeof prefHeight === 'string' && prefHeight.endsWith?.('%')) {
      prefHeight =
        node.size[1] *
        (parseFloat(prefHeight.substring(0, prefHeight.length - 1)) / 100)
    } else {
      prefHeight =
        typeof prefHeight === 'number' ? prefHeight : parseInt(prefHeight)

      if (isNaN(minHeight)) {
        minHeight = prefHeight
      }
    }

    return {
      minHeight: isNaN(minHeight) ? 50 : minHeight,
      maxHeight: isNaN(maxHeight) ? undefined : maxHeight,
      minWidth: 0
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    node: LGraphNode,
    widgetWidth: number,
    y: number
  ): void {
    const { offset, scale } = app.canvas.ds
    const hidden =
      (!!this.options.hideOnZoom && app.canvas.low_quality) ||
      (this.computedHeight ?? 0) <= 0 ||
      // @ts-expect-error custom widget type
      this.type === 'converted-widget' ||
      // @ts-expect-error custom widget type
      this.type === 'hidden' ||
      node.collapsed

    this.element.dataset.shouldHide = hidden ? 'true' : 'false'
    const isInVisibleNodes = this.element.dataset.isInVisibleNodes === 'true'
    const actualHidden = hidden || !isInVisibleNodes
    const wasHidden = this.element.hidden
    this.element.hidden = actualHidden
    this.element.style.display = actualHidden ? 'none' : ''

    if (actualHidden && !wasHidden) {
      this.options.onHide?.(this)
    }
    if (actualHidden) {
      return
    }

    const elRect = ctx.canvas.getBoundingClientRect()
    const margin = 10
    const top = node.pos[0] + offset[0] + margin
    const left = node.pos[1] + offset[1] + margin + y

    Object.assign(this.element.style, {
      transformOrigin: '0 0',
      transform: `scale(${scale})`,
      left: `${top * scale}px`,
      top: `${left * scale}px`,
      width: `${widgetWidth - margin * 2}px`,
      height: `${(this.computedHeight ?? 50) - margin * 2}px`,
      position: 'absolute',
      zIndex: app.graph.nodes.indexOf(node),
      pointerEvents: app.canvas.read_only ? 'none' : 'auto'
    })

    if (useSettingStore().get('Comfy.DOMClippingEnabled')) {
      const clipPath = getClipPath(node, this.element, elRect)
      this.element.style.clipPath = clipPath ?? 'none'
      this.element.style.willChange = 'clip-path'
    }

    this.options.onDraw?.(this)
  }

  onRemove(): void {
    if (this.mouseDownHandler) {
      document.removeEventListener('mousedown', this.mouseDownHandler)
    }
    this.element.remove()
    useDomWidgetStore().unregisterWidget(this.id)
  }
}

LGraphNode.prototype.addDOMWidget = function <
  T extends HTMLElement,
  V extends object | string
>(
  this: LGraphNode,
  name: string,
  type: string,
  element: T,
  options: DOMWidgetOptions<T, V> = {}
): DOMWidget<T, V> {
  options = { hideOnZoom: true, selectOn: ['focus', 'click'], ...options }

  element.hidden = true
  element.style.display = 'none'

  const { nodeData } = this.constructor
  const tooltip = (nodeData?.input.required?.[name] ??
    nodeData?.input.optional?.[name])?.[1]?.tooltip
  if (tooltip && !element.title) {
    element.title = tooltip
  }

  const widget = new DOMWidgetImpl({
    id: `${this.id}:${name}:${generateRandomSuffix()}`,
    name,
    type,
    element,
    options
  })

  // Workaround for https://github.com/Comfy-Org/ComfyUI_frontend/issues/2493
  // Some custom nodes are explicitly expecting getter and setter of `value`
  // property to be on instance instead of prototype.
  Object.defineProperty(widget, 'value', {
    get(this: DOMWidgetImpl<T, V>): V {
      return this.options.getValue?.() ?? ('' as V)
    },
    set(this: DOMWidgetImpl<T, V>, v: V) {
      this.options.setValue?.(v)
      this.callback?.(this.value)
    }
  })

  // Ensure selectOn exists before iteration
  const selectEvents = options.selectOn ?? ['focus', 'click']
  for (const evt of selectEvents) {
    element.addEventListener(evt, () => {
      app.canvas.selectNode(this)
      app.canvas.bringToFront(this)
    })
  }

  this.addCustomWidget(widget)
  elementWidgets.add(this)

  const onRemoved = this.onRemoved
  this.onRemoved = function (this: LGraphNode) {
    widget.onRemove()
    elementWidgets.delete(this)
    onRemoved?.call(this)
  }

  this.onResize = useChainCallback(this.onResize, () => {
    options.beforeResize?.call(widget, this)
    options.afterResize?.call(widget, this)
  })

  useDomWidgetStore().registerWidget(widget)

  return widget
}
