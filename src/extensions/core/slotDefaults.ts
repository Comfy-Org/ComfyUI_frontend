import { app } from '../../scripts/app'
import { ComfyWidgets } from '../../scripts/widgets'
import { LiteGraph } from '@comfyorg/litegraph'
// Adds defaults for quickly adding nodes with middle click on the input/output

app.registerExtension({
  name: 'Comfy.SlotDefaults',
  suggestionsNumber: null,
  init() {
    LiteGraph.search_filter_enabled = true
    LiteGraph.middle_click_slot_add_default_node = true
    this.suggestionsNumber = app.ui.settings.addSetting({
      id: 'Comfy.NodeSuggestions.number',
      category: ['Comfy', 'Node Search Box', 'NodeSuggestions'],
      name: 'Number of nodes suggestions',
      tooltip: 'Only for litegraph searchbox/context menu',
      type: 'slider',
      attrs: {
        min: 1,
        max: 100,
        step: 1
      },
      defaultValue: 5,
      onChange: (newVal, oldVal) => {
        this.setDefaults(newVal)
      }
    })
  },
  slot_types_default_out: {},
  slot_types_default_in: {},
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    var nodeId = nodeData.name
    const inputs = nodeData['input']?.['required'] //only show required inputs to reduce the mess also not logical to create node with optional inputs
    for (const inputKey in inputs) {
      var input = inputs[inputKey]
      if (typeof input[0] !== 'string') continue

      var type = input[0]
      if (type in ComfyWidgets) {
        var customProperties = input[1]
        if (!customProperties?.forceInput) continue //ignore widgets that don't force input
      }

      if (!(type in this.slot_types_default_out)) {
        this.slot_types_default_out[type] = ['Reroute']
      }
      if (this.slot_types_default_out[type].includes(nodeId)) continue
      this.slot_types_default_out[type].push(nodeId)

      // Input types have to be stored as lower case
      // Store each node that can handle this input type
      const lowerType = type.toLocaleLowerCase()
      if (!(lowerType in LiteGraph.registered_slot_in_types)) {
        LiteGraph.registered_slot_in_types[lowerType] = { nodes: [] }
      }
      LiteGraph.registered_slot_in_types[lowerType].nodes.push(
        // @ts-expect-error ComfyNode
        nodeType.comfyClass
      )
    }

    var outputs = nodeData['output'] ?? []
    for (const el of outputs) {
      const type = el as string
      if (!(type in this.slot_types_default_in)) {
        this.slot_types_default_in[type] = ['Reroute'] // ["Reroute", "Primitive"];  primitive doesn't always work :'()
      }

      this.slot_types_default_in[type].push(nodeId)

      // Store each node that can handle this output type
      if (!(type in LiteGraph.registered_slot_out_types)) {
        LiteGraph.registered_slot_out_types[type] = { nodes: [] }
      }
      // @ts-expect-error ComfyNode
      LiteGraph.registered_slot_out_types[type].nodes.push(nodeType.comfyClass)

      if (!LiteGraph.slot_types_out.includes(type)) {
        LiteGraph.slot_types_out.push(type)
      }
    }

    var maxNum = this.suggestionsNumber.value
    this.setDefaults(maxNum)
  },
  setDefaults(maxNum?: number | null) {
    LiteGraph.slot_types_default_out = {}
    LiteGraph.slot_types_default_in = {}

    for (const type in this.slot_types_default_out) {
      LiteGraph.slot_types_default_out[type] = this.slot_types_default_out[
        type
      ].slice(0, maxNum)
    }
    for (const type in this.slot_types_default_in) {
      LiteGraph.slot_types_default_in[type] = this.slot_types_default_in[
        type
      ].slice(0, maxNum)
    }
  }
})
