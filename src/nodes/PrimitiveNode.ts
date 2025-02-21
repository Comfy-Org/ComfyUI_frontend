// @ts-strict-ignore
import { LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import type { INodeInputSlot, INodeSlot, IWidget } from '@comfyorg/litegraph'

import { app } from '@/scripts/app'
import { applyTextReplacements } from '@/scripts/utils'
import { ComfyWidgets, addValueControlWidgets } from '@/scripts/widgets'
import type { InputSpec } from '@/types/apiTypes'

export const CONVERTED_TYPE = 'converted-widget'
const VALID_TYPES = [
  'STRING',
  'combo',
  'number',
  'toggle',
  'BOOLEAN',
  'text',
  'string'
]
export const CONFIG = Symbol()
export const GET_CONFIG = Symbol()
export const TARGET = Symbol() // Used for reroutes to specify the real target widget

const replacePropertyName = 'Run widget replace on values'
export class PrimitiveNode extends LGraphNode {
  controlValues: any[]
  lastType: string
  static category: string
  constructor(title?: string) {
    super(title)
    this.addOutput('connect to widget input', '*')
    this.serialize_widgets = true
    this.isVirtualNode = true

    if (!this.properties || !(replacePropertyName in this.properties)) {
      this.addProperty(replacePropertyName, false, 'boolean')
    }
  }

  applyToGraph(extraLinks = []) {
    if (!this.outputs[0].links?.length) return

    function get_links(node: LGraphNode) {
      let links = []
      for (const l of node.outputs[0].links) {
        const linkInfo = app.graph.links[l]
        const n = node.graph.getNodeById(linkInfo.target_id)
        if (n.type == 'Reroute') {
          links = links.concat(get_links(n))
        } else {
          links.push(l)
        }
      }
      return links
    }

    const links = [
      ...get_links(this).map((l) => app.graph.links[l]),
      ...extraLinks
    ]
    let v = this.widgets?.[0].value
    if (v && this.properties[replacePropertyName]) {
      v = applyTextReplacements(app, v as string)
    }

    // For each output link copy our value over the original widget value
    for (const linkInfo of links) {
      const node = this.graph.getNodeById(linkInfo.target_id)
      const input = node.inputs[linkInfo.target_slot]
      let widget
      if (input.widget[TARGET]) {
        widget = input.widget[TARGET]
      } else {
        const widgetName = (input.widget as { name: string }).name
        if (widgetName) {
          widget = node.widgets.find((w) => w.name === widgetName)
        }
      }

      if (widget) {
        widget.value = v
        if (widget.callback) {
          widget.callback(
            widget.value,
            app.canvas,
            node,
            app.canvas.graph_mouse,
            {}
          )
        }
      }
    }
  }

  refreshComboInNode() {
    const widget = this.widgets?.[0]
    if (widget?.type === 'combo') {
      widget.options.values = this.outputs[0].widget[GET_CONFIG]()[0]

      if (!widget.options.values.includes(widget.value as string)) {
        widget.value = widget.options.values[0]
        widget.callback(widget.value)
      }
    }
  }

  onAfterGraphConfigured() {
    if (this.outputs[0].links?.length && !this.widgets?.length) {
      // @ts-expect-error TODO: Review this check
      if (!this.#onFirstConnection()) return

      // Populate widget values from config data
      if (this.widgets) {
        for (let i = 0; i < this.widgets_values.length; i++) {
          const w = this.widgets[i]
          if (w) {
            // @ts-expect-error change widget type from string to unknown
            w.value = this.widgets_values[i]
          }
        }
      }

      // Merge values if required
      this.#mergeWidgetConfig()
    }
  }

  onConnectionsChange(_, index, connected) {
    if (app.configuringGraph) {
      // Dont run while the graph is still setting up
      return
    }

    const links = this.outputs[0].links
    if (connected) {
      if (links?.length && !this.widgets?.length) {
        this.#onFirstConnection()
      }
    } else {
      // We may have removed a link that caused the constraints to change
      this.#mergeWidgetConfig()

      if (!links?.length) {
        this.onLastDisconnect()
      }
    }
  }

  onConnectOutput(slot, type, input, target_node, target_slot) {
    // Fires before the link is made allowing us to reject it if it isn't valid
    // No widget, we cant connect
    if (!input.widget) {
      if (!(input.type in ComfyWidgets)) return false
    }

    if (this.outputs[slot].links?.length) {
      const valid = this.#isValidConnection(input)
      if (valid) {
        // On connect of additional outputs, copy our value to their widget
        this.applyToGraph([{ target_id: target_node.id, target_slot }])
      }
      return valid
    }
  }

  #onFirstConnection(recreating?: boolean) {
    // First connection can fire before the graph is ready on initial load so random things can be missing
    if (!this.outputs[0].links) {
      this.onLastDisconnect()
      return
    }
    const linkId = this.outputs[0].links[0]
    const link = this.graph.links[linkId]
    if (!link) return

    const theirNode = this.graph.getNodeById(link.target_id)
    if (!theirNode || !theirNode.inputs) return

    const input = theirNode.inputs[link.target_slot]
    if (!input) return

    let widget
    if (!input.widget) {
      if (!(input.type in ComfyWidgets)) return
      widget = { name: input.name, [GET_CONFIG]: () => [input.type, {}] } //fake widget
    } else {
      widget = input.widget
    }

    const config = widget[GET_CONFIG]?.()
    if (!config) return

    const { type } = getWidgetType(config)
    // Update our output to restrict to the widget type
    this.outputs[0].type = type
    this.outputs[0].name = type
    this.outputs[0].widget = widget

    this.#createWidget(
      widget[CONFIG] ?? config,
      theirNode,
      widget.name,
      recreating,
      widget[TARGET]
    )
  }

  #createWidget(inputData, node, widgetName, recreating, targetWidget) {
    let type = inputData[0]

    if (type instanceof Array) {
      type = 'COMBO'
    }

    // Store current size as addWidget resizes the node
    const [oldWidth, oldHeight] = this.size
    let widget
    if (type in ComfyWidgets) {
      widget = (ComfyWidgets[type](this, 'value', inputData, app) || {}).widget
    } else {
      widget = this.addWidget(type, 'value', null, () => {}, {})
    }

    if (targetWidget) {
      widget.value = targetWidget.value
    } else if (node?.widgets && widget) {
      const theirWidget = node.widgets.find((w) => w.name === widgetName)
      if (theirWidget) {
        widget.value = theirWidget.value
      }
    }

    if (
      !inputData?.[1]?.control_after_generate &&
      (widget.type === 'number' || widget.type === 'combo')
    ) {
      let control_value = this.widgets_values?.[1]
      if (!control_value) {
        control_value = 'fixed'
      }
      addValueControlWidgets(
        this,
        widget,
        control_value as string,
        undefined,
        inputData
      )
      const filter = this.widgets_values?.[2]
      if (filter && this.widgets.length === 3) {
        // @ts-expect-error change widget type from string to unknown
        this.widgets[2].value = filter
      }
    }

    // Restore any saved control values
    const controlValues = this.controlValues
    if (
      this.lastType === this.widgets[0].type &&
      controlValues?.length === this.widgets.length - 1
    ) {
      for (let i = 0; i < controlValues.length; i++) {
        this.widgets[i + 1].value = controlValues[i]
      }
    }

    // When our value changes, update other widgets to reflect our changes
    // e.g. so LoadImage shows correct image
    const callback = widget.callback
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    widget.callback = function () {
      // eslint-disable-next-line prefer-rest-params
      const r = callback ? callback.apply(this, arguments) : undefined
      self.applyToGraph()
      return r
    }

    // Use the biggest dimensions in case the widgets caused the node to grow
    this.setSize([
      Math.max(this.size[0], oldWidth),
      Math.max(this.size[1], oldHeight)
    ])

    if (!recreating) {
      // Grow our node more if required
      const sz = this.computeSize()
      if (this.size[0] < sz[0]) {
        this.size[0] = sz[0]
      }
      if (this.size[1] < sz[1]) {
        this.size[1] = sz[1]
      }

      requestAnimationFrame(() => {
        if (this.onResize) {
          this.onResize(this.size)
        }
      })
    }
  }

  recreateWidget() {
    const values = this.widgets?.map((w) => w.value)
    this.#removeWidgets()
    this.#onFirstConnection(true)
    if (values?.length) {
      for (let i = 0; i < this.widgets?.length; i++)
        this.widgets[i].value = values[i]
    }
    return this.widgets?.[0]
  }

  #mergeWidgetConfig() {
    // Merge widget configs if the node has multiple outputs
    const output = this.outputs[0]
    const links = output.links

    const hasConfig = !!output.widget[CONFIG]
    if (hasConfig) {
      delete output.widget[CONFIG]
    }

    if (links?.length < 2 && hasConfig) {
      // Copy the widget options from the source
      if (links.length) {
        this.recreateWidget()
      }

      return
    }

    const config1 = output.widget[GET_CONFIG]()
    const isNumber = config1[0] === 'INT' || config1[0] === 'FLOAT'
    if (!isNumber) return

    for (const linkId of links) {
      const link = app.graph.links[linkId]
      if (!link) continue // Can be null when removing a node

      const theirNode = app.graph.getNodeById(link.target_id)
      const theirInput = theirNode.inputs[link.target_slot]

      // Call is valid connection so it can merge the configs when validating
      this.#isValidConnection(theirInput, hasConfig)
    }
  }

  isValidWidgetLink(
    originSlot: number,
    targetNode: LGraphNode,
    targetWidget: IWidget
  ) {
    const config2 = getConfig.call(targetNode, targetWidget.name) ?? [
      targetWidget.type,
      targetWidget.options || {}
    ]
    if (!isConvertibleWidget(targetWidget, config2)) return false

    const output = this.outputs[originSlot]
    if (!(output.widget?.[CONFIG] ?? output.widget?.[GET_CONFIG]())) {
      // No widget defined for this primitive yet so allow it
      return true
    }

    return !!mergeIfValid.call(this, output, config2)
  }

  #isValidConnection(input: INodeInputSlot, forceUpdate?: boolean) {
    // Only allow connections where the configs match
    const output = this.outputs[0]
    const config2 = input.widget[GET_CONFIG]()
    return !!mergeIfValid.call(
      this,
      output,
      config2,
      forceUpdate,
      this.recreateWidget
    )
  }

  #removeWidgets() {
    if (this.widgets) {
      // Allow widgets to cleanup
      for (const w of this.widgets) {
        if (w.onRemove) {
          w.onRemove()
        }
      }

      // Temporarily store the current values in case the node is being recreated
      // e.g. by group node conversion
      this.controlValues = []
      this.lastType = this.widgets[0]?.type
      for (let i = 1; i < this.widgets.length; i++) {
        this.controlValues.push(this.widgets[i].value)
      }
      setTimeout(() => {
        delete this.lastType
        delete this.controlValues
      }, 15)
      this.widgets.length = 0
    }
  }

  onLastDisconnect() {
    // We cant remove + re-add the output here as if you drag a link over the same link
    // it removes, then re-adds, causing it to break
    this.outputs[0].type = '*'
    this.outputs[0].name = 'connect to widget input'
    delete this.outputs[0].widget

    this.#removeWidgets()
  }
}

export function getWidgetConfig(slot: INodeSlot) {
  return slot.widget[CONFIG] ?? slot.widget[GET_CONFIG]?.() ?? ['*', {}]
}

export function getConfig(widgetName: string) {
  const { nodeData } = this.constructor
  return (
    nodeData?.input?.required?.[widgetName] ??
    nodeData?.input?.optional?.[widgetName]
  )
}

export function isConvertibleWidget(
  widget: IWidget,
  config: InputSpec
): boolean {
  return (
    (VALID_TYPES.includes(widget.type) || VALID_TYPES.includes(config[0])) &&
    !widget.options?.forceInput
  )
}

export function hideWidget(
  node: LGraphNode,
  widget: IWidget,
  options: { suffix?: string; holdSpace?: boolean } = {}
) {
  const { suffix = '', holdSpace = true } = options

  if (widget.type?.startsWith(CONVERTED_TYPE)) return
  widget.origType = widget.type
  widget.origComputeSize = widget.computeSize
  widget.origSerializeValue = widget.serializeValue
  // @ts-expect-error custom widget type
  widget.type = CONVERTED_TYPE + suffix
  if (holdSpace) {
    widget.computeSize = () => [0, LiteGraph.NODE_WIDGET_HEIGHT]
  } else {
    // -4 is due to the gap litegraph adds between widgets automatically
    widget.computeSize = () => [0, -4]
  }
  widget.serializeValue = (node: LGraphNode, index: number) => {
    // Prevent serializing the widget if we have no input linked
    if (!node.inputs) {
      return undefined
    }
    const node_input = node.inputs.find((i) => i.widget?.name === widget.name)

    if (!node_input || !node_input.link) {
      return undefined
    }
    return widget.origSerializeValue
      ? widget.origSerializeValue(node, index)
      : widget.value
  }

  // Hide any linked widgets, e.g. seed+seedControl
  if (widget.linkedWidgets) {
    for (const w of widget.linkedWidgets) {
      hideWidget(node, w, { suffix: ':' + widget.name, holdSpace: false })
    }
  }
}

function showWidget(widget: IWidget) {
  // @ts-expect-error custom widget type
  widget.type = widget.origType
  widget.computeSize = widget.origComputeSize
  widget.serializeValue = widget.origSerializeValue

  delete widget.origType
  delete widget.origComputeSize
  delete widget.origSerializeValue

  // Hide any linked widgets, e.g. seed+seedControl
  if (widget.linkedWidgets) {
    for (const w of widget.linkedWidgets) {
      showWidget(w)
    }
  }
}

export function convertToInput(
  node: LGraphNode,
  widget: IWidget,
  config: InputSpec
) {
  hideWidget(node, widget)

  const { type } = getWidgetType(config)

  // Add input and store widget config for creating on primitive node
  const [oldWidth, oldHeight] = node.size
  const inputIsOptional = !!widget.options?.inputIsOptional
  const input = node.addInput(widget.name, type, {
    widget: { name: widget.name, [GET_CONFIG]: () => config },
    ...(inputIsOptional ? { shape: LiteGraph.SlotShape.HollowCircle } : {})
  })

  for (const widget of node.widgets) {
    widget.last_y += LiteGraph.NODE_SLOT_HEIGHT
  }

  // Restore original size but grow if needed
  node.setSize([
    Math.max(oldWidth, node.size[0]),
    Math.max(oldHeight, node.size[1])
  ])
  return input
}

export function convertToWidget(node: LGraphNode, widget: IWidget) {
  showWidget(widget)
  const [oldWidth, oldHeight] = node.size
  node.removeInput(node.inputs.findIndex((i) => i.widget?.name === widget.name))

  for (const widget of node.widgets) {
    widget.last_y -= LiteGraph.NODE_SLOT_HEIGHT
  }

  // Restore original size but grow if needed
  node.setSize([
    Math.max(oldWidth, node.size[0]),
    Math.max(oldHeight, node.size[1])
  ])
}

function getWidgetType(config: InputSpec) {
  // Special handling for COMBO so we restrict links based on the entries
  let type = config[0]
  if (type instanceof Array) {
    type = 'COMBO'
  }
  return { type }
}

export function isValidCombo(combo: string[], obj: unknown) {
  // New input isnt a combo
  if (!(obj instanceof Array)) {
    console.log(`connection rejected: tried to connect combo to ${obj}`)
    return false
  }
  // New input combo has a different size
  if (combo.length !== obj.length) {
    console.log(`connection rejected: combo lists dont match`)
    return false
  }
  // New input combo has different elements
  if (combo.find((v, i) => obj[i] !== v)) {
    console.log(`connection rejected: combo lists dont match`)
    return false
  }

  return true
}

export function isPrimitiveNode(node: LGraphNode): node is PrimitiveNode {
  return node.type === 'PrimitiveNode'
}

export function setWidgetConfig(slot, config, target?: IWidget) {
  if (!slot.widget) return
  if (config) {
    slot.widget[GET_CONFIG] = () => config
    slot.widget[TARGET] = target
  } else {
    delete slot.widget
  }

  if (slot.link) {
    const link = app.graph.links[slot.link]
    if (link) {
      const originNode = app.graph.getNodeById(link.origin_id)
      if (isPrimitiveNode(originNode)) {
        if (config) {
          originNode.recreateWidget()
        } else if (!app.configuringGraph) {
          originNode.disconnectOutput(0)
          originNode.onLastDisconnect()
        }
      }
    }
  }
}

export function mergeIfValid(
  output,
  config2,
  forceUpdate?: boolean,
  recreateWidget?: () => void,
  config1?: unknown
) {
  if (!config1) {
    config1 = getWidgetConfig(output)
  }

  if (config1[0] instanceof Array) {
    if (!isValidCombo(config1[0], config2[0])) return
  } else if (config1[0] !== config2[0]) {
    // Types dont match
    console.log(`connection rejected: types dont match`, config1[0], config2[0])
    return
  }

  const keys = new Set([
    ...Object.keys(config1[1] ?? {}),
    ...Object.keys(config2[1] ?? {})
  ])

  let customConfig
  const getCustomConfig = () => {
    if (!customConfig) {
      if (typeof structuredClone === 'undefined') {
        customConfig = JSON.parse(JSON.stringify(config1[1] ?? {}))
      } else {
        customConfig = structuredClone(config1[1] ?? {})
      }
    }
    return customConfig
  }

  const isNumber = config1[0] === 'INT' || config1[0] === 'FLOAT'
  for (const k of keys.values()) {
    if (
      k !== 'default' &&
      k !== 'forceInput' &&
      k !== 'defaultInput' &&
      k !== 'control_after_generate' &&
      k !== 'multiline' &&
      k !== 'tooltip' &&
      k !== 'dynamicPrompts'
    ) {
      let v1 = config1[1][k]
      let v2 = config2[1]?.[k]

      if (v1 === v2 || (!v1 && !v2)) continue

      if (isNumber) {
        if (k === 'min') {
          const theirMax = config2[1]?.['max']
          if (theirMax != null && v1 > theirMax) {
            console.log('connection rejected: min > max', v1, theirMax)
            return
          }
          getCustomConfig()[k] =
            v1 == null ? v2 : v2 == null ? v1 : Math.max(v1, v2)
          continue
        } else if (k === 'max') {
          const theirMin = config2[1]?.['min']
          if (theirMin != null && v1 < theirMin) {
            console.log('connection rejected: max < min', v1, theirMin)
            return
          }
          getCustomConfig()[k] =
            v1 == null ? v2 : v2 == null ? v1 : Math.min(v1, v2)
          continue
        } else if (k === 'step') {
          let step
          if (v1 == null) {
            // No current step
            step = v2
          } else if (v2 == null) {
            // No new step
            step = v1
          } else {
            if (v1 < v2) {
              // Ensure v1 is larger for the mod
              const a = v2
              v2 = v1
              v1 = a
            }
            if (v1 % v2) {
              console.log(
                'connection rejected: steps not divisible',
                'current:',
                v1,
                'new:',
                v2
              )
              return
            }

            step = v1
          }

          getCustomConfig()[k] = step
          continue
        }
      }

      console.log(`connection rejected: config ${k} values dont match`, v1, v2)
      return
    }
  }

  if (customConfig || forceUpdate) {
    if (customConfig) {
      output.widget[CONFIG] = [config1[0], customConfig]
    }

    const widget = recreateWidget?.call(this)
    // When deleting a node this can be null
    if (widget) {
      const min = widget.options.min
      const max = widget.options.max
      if (min != null && widget.value < min) widget.value = min
      if (max != null && widget.value > max) widget.value = max
      widget.callback(widget.value)
    }
  }

  return { customConfig }
}
