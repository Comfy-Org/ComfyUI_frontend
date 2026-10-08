import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export function pruneCloudNodeTypes(
  previous: Iterable<Pick<ComfyNodeDef, 'name' | 'python_module'>>,
  next: Record<string, ComfyNodeDef>
) {
  for (const { name, python_module } of previous) {
    if (
      python_module.startsWith('custom_nodes.cloud_registry.') &&
      !(name in next) &&
      LiteGraph.registered_node_types[name]
    ) {
      LiteGraph.unregisterNodeType(name)
    }
  }
}
