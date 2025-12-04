import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph, LLink } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

class CustomCombo extends LGraphNode {
  override title = 'Custom Combo'
  constructor(title?: string) {
    super(title ?? 'Custom Combo')
    this.serialize_widgets = true
    const options: { values: string[] } = { values: [] }
    Object.defineProperty(options, 'values', {
      get: () => {
        return this.widgets!.filter(
          (w) => w.name.startsWith('option') && w.value
        ).map((w) => w.value)
      }
    })
    this.addWidget('combo', 'choice', '', () => {}, options)
    const comboWidget = this.widgets?.at(-1)!
    function updateCombo() {
      if (app.configuringGraph) return
      const { values } = options
      if (values.includes(`${comboWidget.value}`)) return
      comboWidget.value = values[0] ?? ''
    }
    comboWidget.callback = useChainCallback(comboWidget.callback, () =>
      this.applyToGraph()
    )
    function addOption(node: LGraphNode) {
      if (!node.widgets) return
      const widgetPostfix =
        node.widgets
          .findLast((w) => w.name.startsWith('option'))
          ?.name?.slice(6) || '-1'
      const newCount = parseInt(widgetPostfix) + 1
      node.addWidget('string', `option${newCount}`, '', () => {})
      const widget = node.widgets.at(-1)
      if (!widget) return

      let value = ''
      Object.defineProperty(widget, 'value', {
        get() {
          return value
        },
        set(v) {
          value = v
          updateCombo()
          if (!node.widgets) return
          const lastWidget = node.widgets.at(-1)
          if (lastWidget === this) {
            if (v) addOption(node)
            return
          }
          if (v || node.widgets.at(-2) !== this || lastWidget?.value) return
          node.widgets.pop()
          node.computeSize(node.size)
        }
      })
    }
    this.addOutput('output', 'string')
    addOption(this)
    // This node is purely frontend and does not impact the resulting prompt so should not be serialized
    this.isVirtualNode = true
  }
  override applyToGraph(extraLinks: LLink[] = []) {
    if (!this.outputs[0].links?.length || !this.graph) return

    const links = [
      ...this.outputs[0].links.map((l) => this.graph!.links[l]),
      ...extraLinks
    ]
    let v = this.widgets?.[0].value
    // For each output link copy our value over the original widget value
    for (const linkInfo of links) {
      const node = this.graph?.getNodeById(linkInfo.target_id)
      const input = node?.inputs[linkInfo.target_slot]
      if (!input) {
        console.warn('Unable to resolve node or input for link', linkInfo)
        continue
      }

      const widgetName = input.widget?.name
      if (!widgetName) {
        console.warn('Invalid widget or widget name', input.widget)
        continue
      }

      const widget = node.widgets?.find((w) => w.name === widgetName)
      if (!widget) {
        console.warn(
          `Unable to find widget "${widgetName}" on node [${node.id}]`
        )
        continue
      }

      widget.value = v
      widget.callback?.(
        widget.value,
        app.canvas,
        node,
        app.canvas.graph_mouse,
        {} as CanvasPointerEvent
      )
    }
  }
}

app.registerExtension({
  name: 'Comfy.CustomCombo',
  registerCustomNodes() {
    LiteGraph.registerNodeType('CustomCombo', CustomCombo)
  }
})
