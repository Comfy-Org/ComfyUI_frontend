import { shallowReactive } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LLink } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

function applyToGraph(this: LGraphNode, extraLinks: LLink[] = []) {
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
      console.warn(`Unable to find widget "${widgetName}" on node [${node.id}]`)
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
    if (app.configuringGraph) return
    if (values.includes(`${comboWidget.value}`)) return
    comboWidget.value = values[0] ?? ''
    comboWidget.callback?.(comboWidget.value)
  }
  comboWidget.callback = useChainCallback(comboWidget.callback, () =>
    this.applyToGraph!()
  )

  function addOption(node: LGraphNode) {
    if (!node.widgets) return
    const newCount = node.widgets.length - 1
    const widgetName = `option${newCount}`
    const widget = node.addWidget('string', widgetName, '', () => {})
    if (!widget) return

    Object.defineProperty(widget, 'value', {
      get() {
        return useWidgetValueStore().getWidget(
          app.rootGraph.id,
          node.id,
          widgetName
        )?.value
      },
      set(v: string) {
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

function onBranchSelectorCreated(this: LGraphNode) {
  this.applyToGraph = applyToGraph

  this.widgets?.pop()
  const values = shallowReactive<string[]>([])
  const node = this

  function getConnectedInputs(): { label: string; index: number }[] {
    return node.inputs
      .slice(0, -1)
      .map((inp, i) => ({
        label: inp.label ?? inp.localized_name ?? inp.name,
        index: i,
        connected: inp.link != null
      }))
      .filter((inp) => inp.connected)
  }

  function getConnectedLabels(): string[] {
    return getConnectedInputs().map((inp) => inp.label)
  }

  function refreshBranchValues() {
    const next = getConnectedLabels()
    values.splice(0, values.length, ...next)
  }

  const comboWidget = this.addWidget('combo', 'branch', '', () => {}, {
    values
  })

  // Also expose values as a live getter so Vue dropdowns always read fresh
  Object.defineProperty(comboWidget.options, 'values', {
    get: () => {
      const live = getConnectedLabels()
      if (
        live.length !== values.length ||
        live.some((v, i) => v !== values[i])
      ) {
        values.splice(0, values.length, ...live)
      }
      return values
    },
    configurable: true,
    enumerable: true
  })

  function syncComboSelection() {
    if (app.configuringGraph) return
    refreshBranchValues()
    if (values.includes(`${comboWidget.value}`)) return
    comboWidget.value = values[0] ?? ''
    comboWidget.callback?.(comboWidget.value)
  }

  comboWidget.serializeValue = () => {
    const connected = getConnectedInputs()
    const idx = connected.findIndex((inp) => inp.label === comboWidget.value)
    return idx >= 0 ? idx : 0
  }

  // Refresh on connection changes (add/remove inputs)
  this.onConnectionsChange = useChainCallback(this.onConnectionsChange, () =>
    requestAnimationFrame(() => syncComboSelection())
  )

  // Restore renamed labels after configure (autogrow recreates inputs fresh)
  this.onConfigure = useChainCallback(
    this.onConfigure,
    (data: { inputs?: Array<{ label?: string; name: string }> }) => {
      if (!data?.inputs) return
      for (const serializedInput of data.inputs) {
        if (!serializedInput.label) continue
        const match = node.inputs.find(
          (inp) => inp.name === serializedInput.name
        )
        if (match) match.label = serializedInput.label
      }
      refreshBranchValues()
    }
  )

  // Allow renaming autogrow input slots via context menu
  this.getSlotMenuOptions = (slot) => {
    const menu: { content: string; slot: typeof slot }[] = []
    if (slot.input) {
      menu.push({ content: 'Rename Slot', slot })
    }
    return menu
  }

  refreshBranchValues()
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
    else if (nodeData?.name === 'BranchNode')
      nodeType.prototype.onNodeCreated = useChainCallback(
        nodeType.prototype.onNodeCreated,
        onBranchSelectorCreated
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
