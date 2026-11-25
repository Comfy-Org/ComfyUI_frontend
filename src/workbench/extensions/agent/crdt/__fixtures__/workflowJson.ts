import type { WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ISerialisedGraph } from '@comfyorg/graph-model/serialisation'

export function toWorkflowJson({
  nodes,
  ...rest
}: ISerialisedGraph): WorkflowJSON {
  return {
    ...rest,
    nodes: nodes.map(({ flags, ...node }) => ({ ...node, flags: { ...flags } }))
  }
}
