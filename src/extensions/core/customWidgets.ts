import { clamp } from 'es-toolkit'
import { computed, shallowReactive } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { GET_CONFIG } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetValue } from '@/types/simplifiedWidget'

import { applyFirstWidgetValueToGraph } from './widgetValuePropagation'
import { widgetId } from '@/types/widgetId'
import type { ComfyExtension } from '@/types/comfy'

function applyToGraph(this: LGraphNode, extraLinks: LLink[] = []) {
  applyFirstWidgetValueToGraph(this, extraLinks)
}

type SerializationNode = Parameters<
  NonNullable<IBaseWidget['serializeValue']>
>[0]

function resolveChoiceValue(
  interiorNode: LGraphNode,
  comboWidget: IBaseWidget,
  resolverNode: SerializationNode = interiorNode
) {
  const choiceInputIndex = interiorNode.inputs.findIndex(
    (input) => input.widget?.name === comboWidget.name
  )
  if (choiceInputIndex < 0 || !('resolveInput' in resolverNode)) {
    return comboWidget.value
  }

  const resolved = resolverNode.resolveInput(choiceInputIndex)
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
    comboWidget.value = values.at(0) ?? ''
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
  widgets.push({
    name: 'index',
    type: 'hidden',
    get value() {
      return widgets.slice(2).findIndex((w) => w.value === comboWidget.value)
    },
    set value(_) {},
    draw: () => undefined,
    hidden: true,
    options: {},
    y: 0,
    serializeValue: (resolverNode: SerializationNode) =>
      widgets
        .slice(2)
        .findIndex(
          (w) => w.value === resolveChoiceValue(this, comboWidget, resolverNode)
        )
  })
  addOption(this)
}

class StubWidget<T extends WidgetValue> extends BaseWidget {
  override serialize = true
  constructor(
    node: LGraphNode,
    name: string,
    protected valueGetter: () => T
  ) {
    super({ name, node, options: { socketless: true }, type: 'hidden', y: 0 })
  }
  drawWidget() {}
  onClick() {}
  override get value(): T {
    return this.valueGetter()
  }
  override set value(_: T) {}
}
function connectedInputsFor(node: LGraphNode, prefix: string = 'autogrow.') {
  return computed(() =>
    node.inputs
      .filter((input) => input.name.startsWith(prefix) && input.link)
      .map((input) => input.label ?? input.localized_name ?? input.name)
  )
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

const finiteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const positiveNumber = (value: unknown) => {
  const n = finiteNumber(value)
  return n !== undefined && n > 0 ? n : undefined
}

const fractionDigits = (value: unknown) => {
  const n = finiteNumber(value)
  return n === undefined ? undefined : clamp(Math.trunc(n), 0, 100)
}

const lastDecimalPlace = (places: number) =>
  Number((10 ** -places).toFixed(places))

function onCustomFloatCreated(this: LGraphNode) {
  const valueWidget = this.widgets?.[0]
  if (!valueWidget) return

  const declaredPrecision = fractionDigits(valueWidget.options.precision) ?? 1
  const declaredStep =
    positiveNumber(valueWidget.options.step2) ??
    lastDecimalPlace(declaredPrecision)
  const declaredRound = valueWidget.options.round
  const declaresRounding = positiveNumber(declaredRound) !== undefined
  const nodePrecision = () => fractionDigits(this.properties.precision)

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
    get: () => nodePrecision() ?? declaredPrecision,
    set: (v) => {
      this.properties.precision = v
      valueWidget.callback?.(valueWidget.value)
    }
  })
  Object.defineProperty(valueWidget.options, 'step2', {
    get: () => {
      const configured = positiveNumber(this.properties.step)
      if (configured !== undefined) return configured
      const places = nodePrecision()
      return places === undefined ? declaredStep : lastDecimalPlace(places)
    },
    set: (v) => (this.properties.step = v)
  })
  Object.defineProperty(valueWidget.options, 'round', {
    get: () => {
      const configured = positiveNumber(this.properties.round)
      if (configured !== undefined) return configured
      const places = nodePrecision()
      return places !== undefined && declaresRounding
        ? lastDecimalPlace(places)
        : declaredRound
    },
    set: (v) => {
      this.properties.round = v
      valueWidget.callback?.(valueWidget.value)
    }
  })
}

export const customWidgetsExtension: ComfyExtension = {
  name: 'Comfy.CustomWidgets',
  beforeRegisterNodeDef(nodeType: typeof LGraphNode, nodeData: ComfyNodeDef) {
    if (nodeData.name === 'CustomCombo')
      nodeType.prototype.onNodeCreated = useChainCallback(
        nodeType.prototype.onNodeCreated,
        onCustomComboCreated
      )
    else if (nodeData.name === 'PrimitiveInt')
      nodeType.prototype.onNodeCreated = useChainCallback(
        nodeType.prototype.onNodeCreated,
        onCustomIntCreated
      )
    else if (nodeData.name === 'PrimitiveFloat')
      nodeType.prototype.onNodeCreated = useChainCallback(
        nodeType.prototype.onNodeCreated,
        onCustomFloatCreated
      )
  },
  getCustomWidgets() {
    return {
      COMFY_BRANCH_INPUT_NAMES: function (node, inputName) {
        const connectedInputs = connectedInputsFor(node)
        const values = () => connectedInputs.value
        node.addCustomWidget(new StubWidget<string[]>(node, inputName, values))
      },
      COMFY_BRANCH_SELECTOR: function (node, inputName) {
        const connectedInputs = connectedInputsFor(node)
        const values = () => connectedInputs.value
        const startValue = connectedInputs.value[0] ?? ''
        node.addWidget('combo', inputName, startValue, () => {}, { values })
        node.onInputAdded = useChainCallback(node.onInputAdded, (input) => {
          if (input.widget?.name !== inputName) return
          input.widget[GET_CONFIG] = () => ['COMBO', { options: values }]
        })
      }
    }
  }
}
