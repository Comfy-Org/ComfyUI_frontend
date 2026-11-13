import type { ComfyNodeDef as ComfyNodeDefV1 } from '@comfyorg/object-info-parser'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeTypeHooks } from '@/platform/nodeApi/v4/defs/defRegistry'

export function hostNodeDef(
  name: string,
  overrides: Partial<ComfyNodeDefV1> = {}
): ComfyNodeDefV1 {
  return {
    name,
    display_name: name,
    category: 'testing',
    python_module: 'nodes',
    description: '',
    input: { required: {} },
    output: [],
    output_name: [],
    output_node: false,
    ...overrides
  }
}

/** Registers a node type as the host does: its extensions hear of it, then LiteGraph registers it. */
export function registerHostType(
  hooks: NodeTypeHooks,
  def: ComfyNodeDefV1
): typeof LGraphNode {
  class HostNode extends LGraphNode {}
  hooks.beforeRegisterNodeDef(HostNode, def)
  LiteGraph.registerNodeType(def.name, HostNode)
  return HostNode
}
