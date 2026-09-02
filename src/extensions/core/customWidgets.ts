import { shallowReactive } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { applyFirstWidgetValueToGraph } from './widgetValuePropagation'
import { widgetId } from '@/types/widgetId'

function applyToGraph(this: LGraphNode, extraLinks: LLink[] = []) {
  applyFirstWidgetValueToGraph(this, extraLinks)
}

/**
 * `node.resolveInput` only exists on the `ExecutableNodeDTO` used while
 * building the API prompt (see `executionUtil.ts`), not on `LGraphNode`
 * itself. Prompt serialization is the only place that can resolve a
 * promoted widget's per-host value, so this is a runtime duck-type check
 * rather than a static one.
 */
type LinkedInputResolver = {
  resolveInput: (
    slot: number
  ) => { widgetInfo?: { value: unknown } } | undefined
}

function hasLinkedInputResolver(
  node: LGraphNode
): node is LGraphNode & LinkedInputResolver {
  return (
    typeof (node as Partial<LinkedInputResolver>).resolveInput === 'function'
  )
}

/**
 * Resolves the choice widget's current effective value.
 *
 * Per ADR-PROMOTION, a promoted widget's host value is not mirrored back onto
 * the interior widget, so `comboWidget.value` is only accurate when
 * `choice` hasn't been converted to a linked subgraph input. When it has,
 * the live value must be resolved the same way prompt serialization
 * resolves any other linked widget input: `resolverNode` is the
 * execution-scoped node passed into `serializeValue`, which is what's
 * actually able to walk the link to the promoted host value.
 */
function resolveChoiceValue(
  interiorNode: LGraphNode,
  comboWidget: IBaseWidget,
  resolverNode: LGraphNode = interiorNode
) {
  const choiceInputIndex = interiorNode.inputs.findIndex(
    (input) => input.widget?.name === comboWidget.name
  )
  if (choiceInputIndex < 0 || !hasLinkedInputResolver(resolverNode)) {
    return comboWidget.value
  }

  const resolved = resolverNode.resolveInput(choiceInputIndex)
  // `resolved.widgetInfo` is only set when the link resolves back to a
  // promoted widget. When `choice` is linked to a real node's output
  // instead, there is no widget to read a value from here -- resolving that
  // upstream execution-time value is out of scope for this fix, so this
  // falls back to the (possibly stale) interior widget value.
  return resolved?.widgetInfo ? resolved.widgetInfo.value : comboWidget.value
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
          useWidgetValueStore().getWidget(
            widgetId(app.rootGraph.id, node.id, widgetName)
          )?.value ?? localValue
        )
      },
      set(v: string) {
        localValue = v
        const state = useWidgetValueStore().getWidget(
          widgetId(app.rootGraph.id, node.id, widgetName)
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
  const node = this
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
    y: 0,
    serializeValue: (resolverNode: LGraphNode, _index: number) =>
      widgets
        .slice(2)
        .findIndex(
          (w) => w.value === resolveChoiceValue(node, comboWidget, resolverNode)
        )
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
