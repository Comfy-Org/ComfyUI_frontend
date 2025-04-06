import { LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  ISlotType,
  IWidget,
  LLink,
  Vector2
} from '@comfyorg/litegraph'
import type { CanvasMouseEvent } from '@comfyorg/litegraph/dist/types/events'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { ComfyWidgets, addValueControlWidgets } from '@/scripts/widgets'
import { mergeInputSpec } from '@/utils/nodeDefUtil'
import { applyTextReplacements } from '@/utils/searchAndReplace'
import { isPrimitiveNode } from '@/utils/typeGuardUtil'

const CONVERTED_TYPE = 'converted-widget'
const VALID_TYPES = [
  'STRING',
  'combo',
  'number',
  'toggle',
  'BOOLEAN',
  'text',
  'string'
]
const CONFIG = Symbol()
const GET_CONFIG = Symbol()

const replacePropertyName = 'Run widget replace on values'
export class PrimitiveNode extends LGraphNode {
  controlValues?: any[]
  lastType?: string
  static category: string
  constructor(title: string) {
    super(title)
    this.addOutput('connect to widget input', '*')
    this.serialize_widgets = true
    this.isVirtualNode = true

    if (!this.properties || !(replacePropertyName in this.properties)) {
      this.addProperty(replacePropertyName, false, 'boolean')
    }
  }

  applyToGraph(extraLinks: LLink[] = []) {
    if (!this.outputs[0].links?.length) return

    let links = [
      ...this.outputs[0].links.map((l) => app.graph.links[l]),
      ...extraLinks
    ]
    let v = this.widgets?.[0].value
    if (v && this.properties[replacePropertyName]) {
      v = applyTextReplacements(app.graph.nodes, v as string)
    }

    // For each output link copy our value over the original widget value
    for (const linkInfo of links) {
      // @ts-expect-error fixme ts strict error
      const node = this.graph.getNodeById(linkInfo.target_id)
      // @ts-expect-error fixme ts strict error
      const input = node.inputs[linkInfo.target_slot]
      let widget: IWidget | undefined
      const widgetName = (input.widget as { name: string }).name
      if (widgetName) {
        // @ts-expect-error fixme ts strict error
        widget = node.widgets.find((w) => w.name === widgetName)
      }

      if (widget) {
        widget.value = v
        if (widget.callback) {
          widget.callback(
            widget.value,
            app.canvas,
            // @ts-expect-error fixme ts strict error
            node,
            app.canvas.graph_mouse,
            {} as CanvasMouseEvent
          )
        }
      }
    }
  }

  refreshComboInNode() {
    const widget = this.widgets?.[0]
    if (widget?.type === 'combo') {
      // @ts-expect-error fixme ts strict error
      widget.options.values = this.outputs[0].widget[GET_CONFIG]()[0]

      // @ts-expect-error fixme ts strict error
      if (!widget.options.values.includes(widget.value as string)) {
        // @ts-expect-error fixme ts strict error
        widget.value = widget.options.values[0]
        ;(widget.callback as Function)(widget.value)
      }
    }
  }

  onAfterGraphConfigured() {
    if (this.outputs[0].links?.length && !this.widgets?.length) {
      // TODO: Review this check
      // @ts-expect-error
      if (!this.#onFirstConnection()) return

      // Populate widget values from config data
      if (this.widgets) {
        // @ts-expect-error fixme ts strict error
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

  onConnectionsChange(_type: ISlotType, _index: number, connected: boolean) {
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

  onConnectOutput(
    slot: number,
    _type: string,
    input: INodeInputSlot,
    target_node: LGraphNode,
    target_slot: number
  ) {
    // Fires before the link is made allowing us to reject it if it isn't valid
    // No widget, we cant connect
    if (!input.widget && !(input.type in ComfyWidgets)) {
      return false
    }

    if (this.outputs[slot].links?.length) {
      const valid = this.#isValidConnection(input)
      if (valid) {
        // On connect of additional outputs, copy our value to their widget
        this.applyToGraph([{ target_id: target_node.id, target_slot } as LLink])
      }
      return valid
    }

    return true
  }

  #onFirstConnection(recreating?: boolean) {
    // First connection can fire before the graph is ready on initial load so random things can be missing
    if (!this.outputs[0].links) {
      this.onLastDisconnect()
      return
    }
    const linkId = this.outputs[0].links[0]
    // @ts-expect-error fixme ts strict error
    const link = this.graph.links[linkId]
    if (!link) return

    // @ts-expect-error fixme ts strict error
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

    // @ts-expect-error fixme ts strict error
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
      // @ts-expect-error fixme ts strict error
      recreating
    )
  }

  #createWidget(
    inputData: InputSpec,
    node: LGraphNode,
    widgetName: string,
    recreating: boolean
  ) {
    let type = inputData[0]

    if (type instanceof Array) {
      type = 'COMBO'
    }

    // Store current size as addWidget resizes the node
    const [oldWidth, oldHeight] = this.size
    let widget: IWidget | undefined
    if (type in ComfyWidgets) {
      widget = (ComfyWidgets[type](this, 'value', inputData, app) || {}).widget
    } else {
      // @ts-expect-error InputSpec is not typed correctly
      widget = this.addWidget(type, 'value', null, () => {}, {})
    }

    if (node?.widgets && widget) {
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
      let filter = this.widgets_values?.[2]
      if (filter && this.widgets && this.widgets.length === 3) {
        this.widgets[2].value = filter
      }
    }

    // Restore any saved control values
    const controlValues = this.controlValues
    if (
      this.widgets &&
      this.lastType === this.widgets[0]?.type &&
      controlValues?.length === this.widgets.length - 1
    ) {
      for (let i = 0; i < controlValues.length; i++) {
        this.widgets[i + 1].value = controlValues[i]
      }
    }

    // When our value changes, update other widgets to reflect our changes
    // e.g. so LoadImage shows correct image
    widget.callback = useChainCallback(widget.callback, () => {
      this.applyToGraph()
    })

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
        this.onResize?.(this.size)
      })
    }
  }

  recreateWidget() {
    const values = this.widgets?.map((w) => w.value)
    this.#removeWidgets()
    this.#onFirstConnection(true)
    if (values?.length && this.widgets) {
      for (let i = 0; i < this.widgets.length; i++)
        this.widgets[i].value = values[i]
    }
    return this.widgets?.[0]
  }

  #mergeWidgetConfig() {
    // Merge widget configs if the node has multiple outputs
    const output = this.outputs[0]
    const links = output.links ?? []

    const hasConfig = !!output.widget?.[CONFIG]
    if (hasConfig) {
      delete output.widget?.[CONFIG]
    }

    if (links?.length < 2 && hasConfig) {
      // Copy the widget options from the source
      if (links.length) {
        this.recreateWidget()
      }

      return
    }
    // @ts-expect-error fixme ts strict error
    const config1 = output.widget?.[GET_CONFIG]?.()
    const isNumber = config1[0] === 'INT' || config1[0] === 'FLOAT'
    if (!isNumber) return

    for (const linkId of links) {
      const link = app.graph.links[linkId]
      if (!link) continue // Can be null when removing a node

      const theirNode = app.graph.getNodeById(link.target_id)
      if (!theirNode) continue
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
    // @ts-expect-error fixme ts strict error
    if (!(output.widget?.[CONFIG] ?? output.widget?.[GET_CONFIG]())) {
      // No widget defined for this primitive yet so allow it
      return true
    }

    return !!mergeIfValid.call(this, output, config2)
  }

  #isValidConnection(input: INodeInputSlot, forceUpdate?: boolean) {
    // Only allow connections where the configs match
    const output = this.outputs[0]
    // @ts-expect-error fixme ts strict error
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

export function getWidgetConfig(slot: INodeInputSlot | INodeOutputSlot) {
  // @ts-expect-error fixme ts strict error
  return slot.widget[CONFIG] ?? slot.widget[GET_CONFIG]?.() ?? ['*', {}]
}

function getConfig(this: LGraphNode, widgetName: string) {
  const { nodeData } = this.constructor
  return (
    nodeData?.input?.required?.[widgetName] ??
    nodeData?.input?.optional?.[widgetName]
  )
}

function isConvertibleWidget(widget: IWidget, config: InputSpec): boolean {
  return (
    // @ts-expect-error InputSpec is not typed correctly
    (VALID_TYPES.includes(widget.type) || VALID_TYPES.includes(config[0])) &&
    !widget.options?.forceInput
  )
}

function hideWidget(
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
    let node_input = node.inputs.find((i) => i.widget?.name === widget.name)

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

// function showWidget(widget: IWidget) {
//   // @ts-expect-error custom widget type
//   widget.type = widget.origType
//   widget.computeSize = widget.origComputeSize
//   widget.serializeValue = widget.origSerializeValue

//   delete widget.origType
//   delete widget.origComputeSize
//   delete widget.origSerializeValue

//   // Hide any linked widgets, e.g. seed+seedControl
//   if (widget.linkedWidgets) {
//     for (const w of widget.linkedWidgets) {
//       showWidget(w)
//     }
//   }
// }

/**
 * Convert a widget to an input slot.
 * @deprecated Widget to socket conversion is no longer necessary, as they co-exist now.
 * @param node The node to convert the widget to an input slot for.
 * @param widget The widget to convert to an input slot.
 * @returns The input slot that was converted from the widget or undefined if the widget is not found.
 */
export function convertToInput(
  node: LGraphNode,
  widget: IWidget
): INodeInputSlot | undefined {
  console.warn(
    'Please remove call to convertToInput. Widget to socket conversion is no longer necessary, as they co-exist now.'
  )
  return node.inputs.find((slot) => slot.widget?.name === widget.name)
}

function getWidgetType(config: InputSpec) {
  // Special handling for COMBO so we restrict links based on the entries
  let type = config[0]
  if (type instanceof Array) {
    type = 'COMBO'
  }
  return { type }
}

export function setWidgetConfig(
  slot: INodeInputSlot | INodeOutputSlot,
  config: InputSpec
) {
  if (!slot.widget) return
  if (config) {
    slot.widget[GET_CONFIG] = () => config
  } else {
    delete slot.widget
  }

  if ('link' in slot) {
    const link = app.graph.links[slot.link ?? -1]
    if (link) {
      const originNode = app.graph.getNodeById(link.origin_id)
      if (originNode && isPrimitiveNode(originNode)) {
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
  output: INodeOutputSlot | INodeInputSlot,
  config2: InputSpec,
  forceUpdate?: boolean,
  recreateWidget?: () => void,
  config1?: InputSpec
): { customConfig: InputSpec[1] } {
  if (!config1) {
    config1 = getWidgetConfig(output)
  }

  // @ts-expect-error fixme ts strict error
  const customSpec = mergeInputSpec(config1, config2)

  if (customSpec || forceUpdate) {
    if (customSpec) {
      // @ts-expect-error fixme ts strict error
      output.widget[CONFIG] = customSpec
    }

    // @ts-expect-error fixme ts strict error
    const widget = recreateWidget?.call(this)
    // When deleting a node this can be null
    if (widget) {
      // @ts-expect-error fixme ts strict error
      const min = widget.options.min
      // @ts-expect-error fixme ts strict error
      const max = widget.options.max
      // @ts-expect-error fixme ts strict error
      if (min != null && widget.value < min) widget.value = min
      // @ts-expect-error fixme ts strict error
      if (max != null && widget.value > max) widget.value = max
      // @ts-expect-error fixme ts strict error
      widget.callback(widget.value)
    }
  }

  // @ts-expect-error fixme ts strict error
  return { customConfig: customSpec[1] }
}

app.registerExtension({
  name: 'Comfy.WidgetInputs',
  settings: [
    {
      id: 'Comfy.NodeInputConversionSubmenus',
      name: 'In the node context menu, place the entries that convert between input/widget in sub-menus.',
      type: 'boolean',
      defaultValue: true
    }
  ],
  async beforeRegisterNodeDef(nodeType, _nodeData, app) {
    // @ts-expect-error adding extra property
    nodeType.prototype.convertWidgetToInput = function (this: LGraphNode) {
      console.warn(
        'Please remove call to convertWidgetToInput. Widget to socket conversion is no longer necessary, as they co-exist now.'
      )
      return false
    }

    nodeType.prototype.onGraphConfigured = useChainCallback(
      nodeType.prototype.onGraphConfigured,
      function (this: LGraphNode) {
        if (!this.inputs) return
        this.widgets ??= []

        for (const input of this.inputs) {
          if (input.widget) {
            const name = input.widget.name
            if (!input.widget[GET_CONFIG]) {
              input.widget[GET_CONFIG] = () => getConfig.call(this, name)
            }

            const w = this.widgets?.find((w) => w.name === name)
            if (w) {
              hideWidget(this, w)
            } else {
              this.removeInput(this.inputs.findIndex((i) => i === input))
            }
          }
        }
      }
    )

    nodeType.prototype.onNodeCreated = useChainCallback(
      nodeType.prototype.onNodeCreated,
      function (this: LGraphNode) {
        // When node is created, convert any force/default inputs
        if (!app.configuringGraph && this.widgets) {
          for (const w of this.widgets) {
            if (w?.options?.forceInput) {
              // const config = getConfig.call(this, w.name) ?? [
              //   w.type,
              //   w.options || {}
              // ]
            }
          }
        }
      }
    )

    nodeType.prototype.onConfigure = useChainCallback(
      nodeType.prototype.onConfigure,
      function (this: LGraphNode) {
        if (!app.configuringGraph && this.inputs) {
          // On copy + paste of nodes, ensure that widget configs are set up
          for (const input of this.inputs) {
            if (input.widget && !input.widget[GET_CONFIG]) {
              const name = input.widget.name
              input.widget[GET_CONFIG] = () => getConfig.call(this, name)
              const w = this.widgets?.find((w) => w.name === name)
              if (w) {
                hideWidget(this, w)
              }
            }
          }
        }
      }
    )

    function isNodeAtPos(pos: Vector2) {
      for (const n of app.graph.nodes) {
        if (n.pos[0] === pos[0] && n.pos[1] === pos[1]) {
          return true
        }
      }
      return false
    }

    // Double click a widget input to automatically attach a primitive
    const origOnInputDblClick = nodeType.prototype.onInputDblClick
    nodeType.prototype.onInputDblClick = function (
      this: LGraphNode,
      slot: number
    ) {
      const r = origOnInputDblClick
        ? // @ts-expect-error fixme ts strict error
          origOnInputDblClick.apply(this, arguments)
        : undefined

      const input = this.inputs[slot]
      if (!input.widget) {
        // Not a widget input or already handled input
        if (
          !(input.type in ComfyWidgets) &&
          // @ts-expect-error fixme ts strict error
          !(input.widget?.[GET_CONFIG]?.()?.[0] instanceof Array)
        ) {
          return r //also Not a ComfyWidgets input or combo (do nothing)
        }
      }

      // Create a primitive node
      const node = LiteGraph.createNode('PrimitiveNode')
      if (!node) return r

      app.graph.add(node)

      // Calculate a position that wont directly overlap another node
      const pos: [number, number] = [
        this.pos[0] - node.size[0] - 30,
        this.pos[1]
      ]
      while (isNodeAtPos(pos)) {
        pos[1] += LiteGraph.NODE_TITLE_HEIGHT
      }

      node.pos = pos
      node.connect(0, this, slot)
      node.title = input.name

      return r
    }
  },
  registerCustomNodes() {
    LiteGraph.registerNodeType(
      'PrimitiveNode',
      Object.assign(PrimitiveNode, {
        title: 'Primitive'
      })
    )
    PrimitiveNode.category = 'utils'
  }
})
