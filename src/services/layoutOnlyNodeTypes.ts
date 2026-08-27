import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

function hasExecutionOutputs(nodeDef: ComfyNodeDef): boolean {
  return nodeDef.output_node || (nodeDef.output?.length ?? 0) > 0
}

export function applyLayoutOnlyNodeTypes(
  nodeDefs: readonly ComfyNodeDef[],
  frontendOnlyNodeTypes: ReadonlySet<string>,
  declaredLayoutOnlyNodeTypes: ReadonlySet<string>
): ComfyNodeDef[] {
  for (const nodeType of declaredLayoutOnlyNodeTypes) {
    if (!frontendOnlyNodeTypes.has(nodeType)) {
      console.warn(
        `Ignoring layout-only declaration for "${nodeType}": extensions can only classify frontend-only node types.`
      )
    }
  }

  return nodeDefs.map((nodeDef) => {
    const declaredFrontendOnlyType =
      frontendOnlyNodeTypes.has(nodeDef.name) &&
      declaredLayoutOnlyNodeTypes.has(nodeDef.name)
    const isLayoutOnly =
      nodeDef.layout_only === true || declaredFrontendOnlyType

    if (!isLayoutOnly) return nodeDef

    if (hasExecutionOutputs(nodeDef)) {
      console.warn(
        `Ignoring layout-only classification for "${nodeDef.name}": the final node definition has outputs or is an output node.`
      )
      return { ...nodeDef, layout_only: false }
    }

    return nodeDef.layout_only === true
      ? nodeDef
      : { ...nodeDef, layout_only: true }
  })
}
