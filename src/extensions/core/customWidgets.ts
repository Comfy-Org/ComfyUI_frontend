import { shallowReactive } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { applyFirstWidgetValueToGraph } from './widgetValuePropagation'

function applyToGraph(this: LGraphNode, extraLinks: LLink[] = []) {
  applyFirstWidgetValueToGraph(this, extraLinks)
}

function onCustomComboCreated(this: LGraphNode) {
  this.applyToGraph = applyToGraph

  const comboWidget = this.widgets![0]
  const values = shallowReactive<string[]>([])
  comboWidget.options.values = values

  const updateCombo = () => {
    values.splice(
      0,
      values.length,
      ...this.widgets!.filter(
        (w) => w.name.startsWith('option') && w.value
      ).map((w) => `${w.value}`)
    )
    if (app.configuringGraph || !this.graph) return
    if (values.includes(`${comboWidget.value}`)) return
    comboWidget.value = values[0] ?? ''
    comboWidget.callback?.(comboWidget.value)
  }
  comboWidget.callback = useChainCallback(comboWidget.callback, () =>
    this.applyToGraph!()
  )
  this.onAdded = useChainCallback(this.onAdded, function () {
    updateCombo()
  })

  function addOption(node: LGraphNode) {
    if (!node.widgets) return
    const newCount = node.widgets.length - 1
    const widgetName = `option${newCount}`
    const widget = node.addWidget('string', widgetName, '', () => {})
    if (!widget) return
    let localValue = `${widget.value ?? ''}`

    Object.defineProperty(widget, 'value', {
      get() {
        return (
          useWidgetValueStore().getWidget(app.rootGraph.id, node.id, widgetName)
            ?.value ?? localValue
        )
      },
      set(v: string) {
        localValue = v
        const state = useWidgetValueStore().getWidget(
          app.rootGraph.id,
          node.id,
          widgetName
        )
        if (state) state.value = v
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
        this.callback(v)
      }
    })
  }
  const widgets = this.widgets!
  widgets.push({
    name: 'index',
    type: 'hidden',
    get value() {
      return widgets.slice(2).findIndex((w) => w.value === comboWidget.value)
    },
    set value(_) {},
    draw: () => undefined,
    computeSize: () => [0, -4],
    options: { hidden: true },
    y: 0
  })
  addOption(this)
}

function onCustomIntCreated(this: LGraphNode) {
  const valueWidget = this.widgets?.[0]
  if (!valueWidget) return

  Object.defineProperty(valueWidget.options, 'min', {
    get: () => this.properties.min ?? -(2 ** 63),
    set: (v) => {
      this.properties.min = v
      valueWidget.callback?.(valueWidget.value)
    }
  })
  Object.defineProperty(valueWidget.options, 'max', {
    get: () => this.properties.max ?? 2 ** 63,
    set: (v) => {
      this.properties.max = v
      valueWidget.callback?.(valueWidget.value)
    }
  })
  Object.defineProperty(valueWidget.options, 'step2', {
    get: () => this.properties.step ?? 1,
    set: (v) => {
      this.properties.step = v
      valueWidget.callback?.(valueWidget.value) // for vue reactivity
    }
  })
}
const DISPLAY_WIDGET_TYPES = new Set(['gradientslider', 'slider', 'knob'])

function onCustomFloatCreated(this: LGraphNode) {
  const valueWidget = this.widgets?.[0]
  if (!valueWidget) return

  let baseType = valueWidget.type
  Object.defineProperty(valueWidget, 'type', {
    get: () => {
      const display = this.properties.display as string | undefined
      if (display && DISPLAY_WIDGET_TYPES.has(display)) return display
      return baseType
    },
    set: (v: string) => {
      baseType = v
    }
  })

  Object.defineProperty(valueWidget.options, 'gradient_stops', {
    enumerable: true,
    get: () => this.properties.gradient_stops,
    set: (v) => {
      this.properties.gradient_stops = v
    }
  })
  Object.defineProperty(valueWidget.options, 'min', {
    get: () => this.properties.min ?? -Infinity,
    set: (v) => {
      this.properties.min = v
      valueWidget.callback?.(valueWidget.value)
    }
  })
  Object.defineProperty(valueWidget.options, 'max', {
    get: () => this.properties.max ?? Infinity,
    set: (v) => {
      this.properties.max = v
      valueWidget.callback?.(valueWidget.value)
    }
  })
  Object.defineProperty(valueWidget.options, 'precision', {
    get: () => this.properties.precision ?? 1,
    set: (v) => {
      this.properties.precision = v
      valueWidget.callback?.(valueWidget.value)
    }
  })
  Object.defineProperty(valueWidget.options, 'step2', {
    get: () => {
      if (this.properties.step) return this.properties.step

      const { precision } = this.properties
      return typeof precision === 'number' ? 5 * 10 ** -precision : 1
    },
    set: (v) => (this.properties.step = v)
  })
  Object.defineProperty(valueWidget.options, 'round', {
    get: () => {
      if (this.properties.round) return this.properties.round

      const { precision } = this.properties
      return typeof precision === 'number' ? 10 ** -precision : 0.1
    },
    set: (v) => {
      this.properties.round = v
      valueWidget.callback?.(valueWidget.value)
    }
  })
}

app.registerExtension({
  name: 'Comfy.CustomWidgets',
  beforeRegisterNodeDef(nodeType: typeof LGraphNode, nodeData: ComfyNodeDef) {
    if (nodeData?.name === 'CustomCombo')
      nodeType.prototype.onNodeCreated = useChainCallback(
        nodeType.prototype.onNodeCreated,
        onCustomComboCreated
      )
    else if (nodeData?.name === 'PrimitiveInt')
      nodeType.prototype.onNodeCreated = useChainCallback(
        nodeType.prototype.onNodeCreated,
        onCustomIntCreated
      )
    else if (nodeData?.name === 'PrimitiveFloat')
      nodeType.prototype.onNodeCreated = useChainCallback(
        nodeType.prototype.onNodeCreated,
        onCustomFloatCreated
      )
  }
})
