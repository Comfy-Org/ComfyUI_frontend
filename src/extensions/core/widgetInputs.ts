// @ts-strict-ignore
import { LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import type { LiteGraphCanvasEvent } from '@comfyorg/litegraph'
import type { IFoundSlot } from '@comfyorg/litegraph'

import {
  CONVERTED_TYPE,
  GET_CONFIG,
  PrimitiveNode,
  convertToInput,
  convertToWidget,
  getConfig,
  hideWidget,
  isConvertibleWidget,
  isValidCombo
} from '@/nodes/PrimitiveNode'
import { app } from '@/scripts/app'
import { ComfyWidgets } from '@/scripts/widgets'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'

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
  setup() {
    app.canvas.getWidgetLinkType = function (widget, node) {
      const nodeDefStore = useNodeDefStore()
      const nodeDef = nodeDefStore.nodeDefsByName[node.type]
      const input = nodeDef.inputs.getInput(widget.name)
      return input?.type
    }

    document.addEventListener(
      'litegraph:canvas',
      async (e: LiteGraphCanvasEvent) => {
        if (e.detail.subType === 'connectingWidgetLink') {
          const { node, link, widget } = e.detail
          if (!node || !link || !widget) return

          const nodeData = node.constructor.nodeData
          if (!nodeData) return
          const all = {
            ...nodeData?.input?.required,
            ...nodeData?.input?.optional
          }
          const inputSpec = all[widget.name]
          if (!inputSpec) return

          const input = convertToInput(node, widget, inputSpec)
          if (!input) return

          const originNode = link.node

          originNode.connect(link.slot, node, node.inputs.lastIndexOf(input))
        }
      }
    )
  },
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    // Add menu options to convert to/from widgets
    const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions
    // @ts-expect-error adding extra property
    nodeType.prototype.convertWidgetToInput = function (widget) {
      const config = getConfig.call(this, widget.name) ?? [
        widget.type,
        widget.options || {}
      ]
      if (!isConvertibleWidget(widget, config)) return false
      if (widget.type?.startsWith(CONVERTED_TYPE)) return false
      convertToInput(this, widget, config)
      return true
    }

    nodeType.prototype.getExtraSlotMenuOptions = function (
      this: LGraphNode,
      slot: IFoundSlot
    ) {
      if (!slot.input || !slot.input.widget) return []

      const widget = this.widgets.find((w) => w.name === slot.input.widget.name)
      if (!widget) return []
      return [
        {
          content: `Convert to widget`,
          callback: () => convertToWidget(this, widget)
        }
      ]
    }

    nodeType.prototype.getExtraMenuOptions = function (_, options) {
      const r = origGetExtraMenuOptions
        ? origGetExtraMenuOptions.apply(this, arguments)
        : undefined

      const getPointerCanvasPos = () => {
        const pos = this.graph?.list_of_graphcanvas?.at(0)?.graph_mouse
        return pos ? { canvasX: pos[0], canvasY: pos[1] } : undefined
      }

      if (this.widgets) {
        const { canvasX, canvasY } = getPointerCanvasPos()
        const widget = this.getWidgetOnPos(canvasX, canvasY)
        // @ts-expect-error custom widget type
        if (widget && widget.type !== CONVERTED_TYPE) {
          const config = getConfig.call(this, widget.name) ?? [
            widget.type,
            widget.options || {}
          ]
          if (isConvertibleWidget(widget, config)) {
            options.push({
              content: `Convert ${widget.name} to input`,
              callback: () => convertToInput(this, widget, config) && false
            })
          }
        }
        let toInput = []
        let toWidget = []
        for (const w of this.widgets) {
          if (w.options?.forceInput) {
            continue
          }
          // @ts-expect-error custom widget type
          if (w.type === CONVERTED_TYPE) {
            toWidget.push({
              // @ts-expect-error never
              content: `Convert ${w.name} to widget`,
              callback: () => convertToWidget(this, w)
            })
          } else {
            const config = getConfig.call(this, w.name) ?? [
              w.type,
              w.options || {}
            ]
            if (isConvertibleWidget(w, config)) {
              toInput.push({
                content: `Convert ${w.name} to input`,
                callback: () => convertToInput(this, w, config)
              })
            }
          }
        }

        //Convert.. main menu
        if (toInput.length) {
          if (useSettingStore().get('Comfy.NodeInputConversionSubmenus')) {
            options.push({
              content: 'Convert Widget to Input',
              submenu: {
                options: toInput
              }
            })
          } else {
            options.push(...toInput, null)
          }
        }
        if (toWidget.length) {
          if (useSettingStore().get('Comfy.NodeInputConversionSubmenus')) {
            options.push({
              content: 'Convert Input to Widget',
              submenu: {
                options: toWidget
              }
            })
          } else {
            options.push(...toWidget, null)
          }
        }
      }

      return r
    }

    nodeType.prototype.onGraphConfigured = function () {
      if (!this.inputs) return
      this.widgets ??= []

      for (const input of this.inputs) {
        if (input.widget) {
          if (!input.widget[GET_CONFIG]) {
            input.widget[GET_CONFIG] = () =>
              getConfig.call(this, input.widget.name)
          }

          // Cleanup old widget config
          if (input.widget.config) {
            if (input.widget.config[0] instanceof Array) {
              // If we are an old converted combo then replace the input type and the stored link data
              input.type = 'COMBO'

              const link = app.graph.links[input.link]
              if (link) {
                link.type = input.type
              }
            }
            delete input.widget.config
          }

          const w = this.widgets.find((w) => w.name === input.widget.name)
          if (w) {
            hideWidget(this, w)
          } else {
            convertToWidget(this, input)
          }
        }
      }
    }

    const origOnNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function () {
      const r = origOnNodeCreated ? origOnNodeCreated.apply(this) : undefined

      // When node is created, convert any force/default inputs
      if (!app.configuringGraph && this.widgets) {
        for (const w of this.widgets) {
          if (w?.options?.forceInput || w?.options?.defaultInput) {
            const config = getConfig.call(this, w.name) ?? [
              w.type,
              w.options || {}
            ]
            convertToInput(this, w, config)
          }
        }
      }

      return r
    }

    const origOnConfigure = nodeType.prototype.onConfigure
    nodeType.prototype.onConfigure = function () {
      const r = origOnConfigure
        ? origOnConfigure.apply(this, arguments)
        : undefined
      if (!app.configuringGraph && this.inputs) {
        // On copy + paste of nodes, ensure that widget configs are set up
        for (const input of this.inputs) {
          if (input.widget && !input.widget[GET_CONFIG]) {
            input.widget[GET_CONFIG] = () =>
              getConfig.call(this, input.widget.name)
            const w = this.widgets.find((w) => w.name === input.widget.name)
            if (w) {
              hideWidget(this, w)
            }
          }
        }
      }

      return r
    }

    function isNodeAtPos(pos) {
      for (const n of app.graph.nodes) {
        if (n.pos[0] === pos[0] && n.pos[1] === pos[1]) {
          return true
        }
      }
      return false
    }

    // Double click a widget input to automatically attach a primitive
    const origOnInputDblClick = nodeType.prototype.onInputDblClick
    const ignoreDblClick = Symbol()
    nodeType.prototype.onInputDblClick = function (slot) {
      const r = origOnInputDblClick
        ? origOnInputDblClick.apply(this, arguments)
        : undefined

      const input = this.inputs[slot]
      if (!input.widget || !input[ignoreDblClick]) {
        // Not a widget input or already handled input
        if (
          !(input.type in ComfyWidgets) &&
          !(input.widget?.[GET_CONFIG]?.()?.[0] instanceof Array)
        ) {
          return r //also Not a ComfyWidgets input or combo (do nothing)
        }
      }

      // Create a primitive node
      const node = LiteGraph.createNode('PrimitiveNode')
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

      // Prevent adding duplicates due to triple clicking
      input[ignoreDblClick] = true
      setTimeout(() => {
        delete input[ignoreDblClick]
      }, 300)

      return r
    }

    // Prevent connecting COMBO lists to converted inputs that dont match types
    const onConnectInput = nodeType.prototype.onConnectInput
    nodeType.prototype.onConnectInput = function (
      targetSlot,
      type,
      output,
      originNode,
      originSlot
    ) {
      // @ts-expect-error onConnectInput has 5 arguments
      const v = onConnectInput?.(this, arguments)
      // Not a combo, ignore
      if (type !== 'COMBO') return v
      // Primitive output, allow that to handle
      if (originNode.outputs[originSlot].widget) return v

      // Ensure target is also a combo
      const targetCombo = this.inputs[targetSlot].widget?.[GET_CONFIG]?.()?.[0]
      if (!targetCombo || !(targetCombo instanceof Array)) return v

      // Check they match
      const originConfig =
        originNode.constructor?.nodeData?.output?.[originSlot]
      if (!originConfig || !isValidCombo(targetCombo, originConfig)) {
        return false
      }

      return v
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
