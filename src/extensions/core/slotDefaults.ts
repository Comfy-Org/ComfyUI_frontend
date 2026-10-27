import { runWhenGlobalIdle } from '@/base/common/async'
import type { SlotTypeDefaultNodeOpts } from '@/lib/litegraph/src/LiteGraphGlobal'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { collectRegistrableSlotTypes } from '@/extensions/core/slotDefaultTypes'
import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyExtension } from '@/types/comfy'

import { app } from '@/scripts/app'

interface SlotDefaultsExtension extends ComfyExtension {
  suggestionsNumber: { value: number } | null
  slot_types_default_out: Record<
    string,
    Array<string | SlotTypeDefaultNodeOpts>
  >
  slot_types_default_in: Record<string, Array<string | SlotTypeDefaultNodeOpts>>
  setDefaults(maxNum?: number | null): void
}

const pendingNodeDefs: ComfyNodeDef[] = []
let pendingIdleFill: ReturnType<typeof runWhenGlobalIdle> | undefined

function snapshotSlotSpecs(nodeData: ComfyNodeDef): ComfyNodeDef {
  const { input, output } = nodeData
  return {
    ...nodeData,
    input: input && {
      ...input,
      required: input.required && { ...input.required },
      optional: input.optional && { ...input.optional }
    },
    output: output && [...output]
  }
}

function registerPendingSlotTypes(extension: SlotDefaultsExtension) {
  pendingIdleFill?.dispose()
  pendingIdleFill = undefined
  for (const nodeData of pendingNodeDefs.splice(0)) {
    try {
      registerSlotTypes(extension, nodeData)
    } catch (cause) {
      reportError(cause, {
        errorType: 'error_registering_slot_defaults',
        surface: 'graph',
        context: { nodeType: nodeData.name }
      })
    }
  }
  extension.setDefaults(extension.suggestionsNumber?.value)
}

function registerSlotTypes(
  extension: SlotDefaultsExtension,
  nodeData: ComfyNodeDef
) {
  const nodeId = nodeData.name
  const { inputTypes, outputTypes } = collectRegistrableSlotTypes(nodeData)

  for (const type of inputTypes) {
    if (!(type in extension.slot_types_default_out)) {
      extension.slot_types_default_out[type] = ['Reroute']
    }
    if (extension.slot_types_default_out[type].includes(nodeId)) continue
    extension.slot_types_default_out[type].push(nodeId)

    const lowerType = type.toLocaleLowerCase()
    if (!(lowerType in LiteGraph.registered_slot_in_types)) {
      LiteGraph.registered_slot_in_types[lowerType] = { nodes: [] }
    }
    LiteGraph.registered_slot_in_types[lowerType].nodes.push(nodeId)
  }

  for (const type of outputTypes) {
    if (!(type in extension.slot_types_default_in)) {
      extension.slot_types_default_in[type] = ['Reroute']
    }
    if (extension.slot_types_default_in[type].includes(nodeId)) continue
    extension.slot_types_default_in[type].push(nodeId)

    if (!(type in LiteGraph.registered_slot_out_types)) {
      LiteGraph.registered_slot_out_types[type] = { nodes: [] }
    }
    LiteGraph.registered_slot_out_types[type].nodes.push(nodeId)

    if (!LiteGraph.slot_types_out.includes(type)) {
      LiteGraph.slot_types_out.push(type)
    }
  }
}

export const slotDefaultsExtension: ComfyExtension = {
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
        this.setDefaults(newVal)
      }
    })
  },
  slot_types_default_out: {},
  slot_types_default_in: {},
  beforeRegisterNodeDef(this: SlotDefaultsExtension, _nodeType, nodeData) {
    pendingNodeDefs.push(snapshotSlotSpecs(nodeData))
    LiteGraph.deferSlotTypeTables(() => registerPendingSlotTypes(this))
    pendingIdleFill ??= runWhenGlobalIdle(() => LiteGraph.flushSlotTypeTables())
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
}
