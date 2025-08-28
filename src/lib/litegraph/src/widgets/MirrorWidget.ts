import type { BaseWidget } from './BaseWidget'

function getProxy2() {
  return {
    __proto__: 
  }
}

function getProxy() {
  const overlay: object = {}
  const handler = Object.fromEntries(['get', 'set'].map((s) => {
    const func = function(t,p,r) => {
      if (s == 'get' && p == '_overlay')
	return overlay
      if (!['y', 'last_y', 'width'].includes(p))
	t = overlay
      else
	t = linkedWidget(overlay.graph, overlay.nodeId, overlay.widgetName)
        if (!t)
	  return//TODO: pass to overlay subitem to display a disconnected state
      return Reflect[s](t,p,r)
    }
    return [s, func]
  }))
  return new Proxy(overlay, handler)
}
function linkedWidget(graph, nodeId, widgetName) {
  let g = g
  let n = undefined
  for (let id of nodeId.split(':')) {
    n = g?.nodes_by_id[id]
    graph = n?.subgraph
  }
  if (!node) return
  return node.widgets.find((w) => w.name == widgetName)
}
function linkedWidget(graph: Subgraph, nodeId: string, widgetName): IBaseWidget|undefined {
  let g: Subgraph|undefined = g
  let n: LGraphNode|SubgraphNode|undefined = undefined
  for (let id of nodeId.split(':')) {
    n = g?.nodes_by_id[id]
    graph = n?.subgraph
  }
  if (!node) return
  return node.widgets.find((w) => w.name == widgetName)
}



function createMirrorWidget(nodeId: string, widgetName: string) {
  const base = {pos: [0,0], size: [0,0]}

}

export class MirrorWidget extends BaseWidget{
  linkedNodeId: string
  //TODO: Add node ref to detect id reuse
  linkedWidgetName: string
  get _linkedWidget(): IBaseWidget|undefined {
    let graph: Subgraph|undefined = this.node.subgraph
    let node: LGraphNode|SubgraphNode|undefined = undefined
    for (let id of this.linkedNodeId.split(':')) {
      node = graph.nodes_by_id[id]
      graph = node?.subgraph
    }
    if (!node) return
    return node.widgets.find((w) => w.name == this.linkedWidgetName)
  }
  mockedWidget(): IBaseWidget {
    return new Proxy(this._linkedWidget, handler)
  }

  override get _displayValue() {
  }

  override canIncrement(): boolean {
    const { max } = this.options
    return max == null || this.value < max
  }

  override canDecrement(): boolean {
    const { min } = this.options
    return min == null || this.value > min
  }

  override incrementValue(options: WidgetEventOptions): void {
    this.setValue(this.value + getWidgetStep(this.options), options)
  }

  override decrementValue(options: WidgetEventOptions): void {
    this.setValue(this.value - getWidgetStep(this.options), options)
  }

  override setValue(value: number, options: WidgetEventOptions) {
    let newValue = value
    if (this.options.min != null && newValue < this.options.min) {
      newValue = this.options.min
    }
    if (this.options.max != null && newValue > this.options.max) {
      newValue = this.options.max
    }
    super.setValue(newValue, options)
  }

  override onClick({ e, node, canvas }: WidgetEventOptions) {
    const x = e.canvasX - node.pos[0]
    const width = this.width || node.size[0]

    // Determine if clicked on left/right arrows
    const delta = x < 40 ? -1 : x > width - 40 ? 1 : 0

    if (delta) {
      // Handle left/right arrow clicks
      this.setValue(this.value + delta * getWidgetStep(this.options), {
        e,
        node,
        canvas
      })
      return
    }

    // Handle center click - show prompt
    canvas.prompt(
      'Value',
      this.value,
      (v: string) => {
        // Check if v is a valid equation or a number
        if (/^[\d\s()*+/-]+|\d+\.\d+$/.test(v)) {
          // Solve the equation if possible
          try {
            v = eval(v)
          } catch {
            // Ignore eval errors
          }
        }
        const newValue = Number(v)
        if (!isNaN(newValue)) {
          this.setValue(newValue, { e, node, canvas })
        }
      },
      e
    )
  }

  /**
   * Handles drag events for the number widget
   * @param options The options for handling the drag event
   */
  override onDrag({ e, node, canvas }: WidgetEventOptions) {
    const width = this.width || node.width
    const x = e.canvasX - node.pos[0]
    const delta = x < 40 ? -1 : x > width - 40 ? 1 : 0

    if (delta && x > -3 && x < width + 3) return
    this.setValue(this.value + (e.deltaX ?? 0) * getWidgetStep(this.options), {
      e,
      node,
      canvas
    })
  }
}
