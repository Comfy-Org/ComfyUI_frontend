import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const declaredLayoutOnlyNodeTypes = new Set<string>()

export function declareLayoutOnlyNodeTypes(nodeTypes: readonly string[]): void {
  for (const nodeType of nodeTypes) declaredLayoutOnlyNodeTypes.add(nodeType)
}

export function applyLayoutOnlyDeclarations(
  nodeDefs: Record<string, ComfyNodeDef>
): void {
  for (const nodeType of declaredLayoutOnlyNodeTypes) {
    const nodeDef = nodeDefs[nodeType]
    if (!nodeDef) continue
    if (nodeDef.output_node || (nodeDef.output?.length ?? 0) > 0) {
      console.warn(
        `Ignoring layout-only declaration for "${nodeType}": its node definition can affect execution (it has output slots or is an output node).`
      )
      continue
    }
    nodeDef.layout_only = true
  }
}

export function isLayoutOnlyNodeType(nodeType: string): boolean {
  return useNodeDefStore().nodeDefsByName[nodeType]?.layout_only === true
}
