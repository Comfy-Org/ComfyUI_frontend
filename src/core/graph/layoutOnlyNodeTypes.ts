import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

interface LayoutOnlyNodeTypeSources {
  trustedLayoutOnlyNodeDefs: ReadonlySet<ComfyNodeDef>
  nodeDefSourceTypes: ReadonlyMap<ComfyNodeDef, string>
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
    nodeDefSourceTypes,
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
    const sourceType = nodeDefSourceTypes.get(nodeDef)
    const normalizedNodeDef =
      sourceType !== undefined && nodeDef.name !== sourceType
        ? { ...nodeDef, name: sourceType }
        : nodeDef
    if (normalizedNodeDef !== nodeDef) {
      console.warn(
        `Ignoring node definition rename from "${sourceType}" to "${nodeDef.name}": node type identities are immutable.`
      )
    }

    const declaredFrontendOnlyType =
      frontendOnlyNodeTypes.has(normalizedNodeDef.name) &&
      declaredLayoutOnlyNodeTypes.has(normalizedNodeDef.name)
    const isLayoutOnly =
      trustedLayoutOnlyNodeDefs.has(nodeDef) || declaredFrontendOnlyType

    if (!isLayoutOnly) {
      if (normalizedNodeDef.layout_only !== true) return normalizedNodeDef
      console.warn(
        `Ignoring untrusted layout-only metadata for "${normalizedNodeDef.name}": extensions must use layoutOnlyNodeTypes for frontend-only node types.`
      )
      return { ...normalizedNodeDef, layout_only: false }
    }

    if (hasExecutionOutputs(normalizedNodeDef)) {
      console.warn(
        `Ignoring layout-only classification for "${normalizedNodeDef.name}": the final node definition has outputs or is an output node.`
      )
      return { ...normalizedNodeDef, layout_only: false }
    }

    return normalizedNodeDef.layout_only === true
      ? normalizedNodeDef
      : { ...normalizedNodeDef, layout_only: true }
  })
}
