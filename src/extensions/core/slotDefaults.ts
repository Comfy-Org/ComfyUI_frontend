import type { ComfyExtension } from '@/types/comfy'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { collectRegistrableSlotTypes } from '@/extensions/core/slotDefaultTypes'

import { app } from '../../scripts/app'

// Adds defaults for quickly adding nodes with middle click on the input/output

interface SlotDefaultsExtension extends ComfyExtension {
  suggestionsNumber: { value: number } | null
  slot_types_default_out: Record<string, string[]>
  slot_types_default_in: Record<string, string[]>
  setDefaults(maxNum?: number | null): void
}

app.registerExtension({
  name: 'Comfy.SlotDefaults',
  suggestionsNumber: null,
  init(this: SlotDefaultsExtension) {
    LiteGraph.search_filter_enabled = true
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
      onChange: (newVal) => {
        this.setDefaults(newVal as number)
      }
    })
  },
  slot_types_default_out: {},
  slot_types_default_in: {},
  async beforeRegisterNodeDef(this: SlotDefaultsExtension, nodeType, nodeData) {
    var nodeId = nodeData.name
    const { inputTypes, outputTypes } = collectRegistrableSlotTypes(nodeData)

    for (const type of inputTypes) {
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

    for (const type of outputTypes) {
      if (!(type in this.slot_types_default_in)) {
        this.slot_types_default_in[type] = ['Reroute']
      }

      if (this.slot_types_default_in[type].includes(nodeId)) continue
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

    var maxNum = this.suggestionsNumber?.value
    this.setDefaults(maxNum)
  },
  setDefaults(this: SlotDefaultsExtension, maxNum?: number | null) {
    LiteGraph.slot_types_default_out = {}
    LiteGraph.slot_types_default_in = {}

    const max = maxNum ?? undefined
    for (const type in this.slot_types_default_out) {
      LiteGraph.slot_types_default_out[type] = this.slot_types_default_out[
        type
      ].slice(0, max)
    }
    for (const type in this.slot_types_default_in) {
      LiteGraph.slot_types_default_in[type] = this.slot_types_default_in[
        type
      ].slice(0, max)
    }
  }
})
