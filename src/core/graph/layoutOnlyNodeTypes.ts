import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

interface LayoutOnlyNodeTypeSources {
  trustedLayoutOnlyNodeDefs: ReadonlySet<ComfyNodeDef>
  frontendOnlyNodeTypes: ReadonlySet<string>
  skippedFrontendOnlyNodeTypes: ReadonlySet<string>
  declaredLayoutOnlyNodeTypes: ReadonlySet<string>
}

function hasExecutionOutputs(nodeDef: ComfyNodeDef): boolean {
  return nodeDef.output_node || (nodeDef.output?.length ?? 0) > 0
}

export function applyLayoutOnlyNodeTypes(
  nodeDefs: readonly ComfyNodeDef[],
  sources: LayoutOnlyNodeTypeSources
): ComfyNodeDef[] {
  const {
    trustedLayoutOnlyNodeDefs,
    frontendOnlyNodeTypes,
    skippedFrontendOnlyNodeTypes,
    declaredLayoutOnlyNodeTypes
  } = sources

  for (const nodeType of declaredLayoutOnlyNodeTypes) {
    if (skippedFrontendOnlyNodeTypes.has(nodeType)) {
      console.warn(
        `Ignoring layout-only declaration for "${nodeType}": skip_list node types do not have Vue node definitions.`
      )
    } else if (!frontendOnlyNodeTypes.has(nodeType)) {
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
      trustedLayoutOnlyNodeDefs.has(nodeDef) || declaredFrontendOnlyType

    if (!isLayoutOnly) {
      if (nodeDef.layout_only !== true) return nodeDef
      console.warn(
        `Ignoring untrusted layout-only metadata for "${nodeDef.name}": extensions must use layoutOnlyNodeTypes for frontend-only node types.`
      )
      return { ...nodeDef, layout_only: false }
    }

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
