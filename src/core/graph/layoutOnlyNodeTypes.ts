import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

interface LayoutOnlyNodeTypeSources {
  nodeDefSources: ReadonlyMap<
    ComfyNodeDef,
    {
      nodeType: string
      trustedLayoutOnly: boolean
      hasExecutionOutputs: boolean
    }
  >
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
    nodeDefSources,
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
    const source = nodeDefSources.get(nodeDef)
    const sourceType = source?.nodeType
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
      source?.trustedLayoutOnly === true || declaredFrontendOnlyType

    if (!isLayoutOnly) {
      if (normalizedNodeDef.layout_only !== true) return normalizedNodeDef
      console.warn(
        `Ignoring untrusted layout-only metadata for "${normalizedNodeDef.name}": extensions must use layoutOnlyNodeTypes for frontend-only node types.`
      )
      return { ...normalizedNodeDef, layout_only: false }
    }

    if (
      source?.hasExecutionOutputs === true ||
      hasExecutionOutputs(normalizedNodeDef)
    ) {
      const executionShape = source?.hasExecutionOutputs
        ? 'source node definition'
        : 'final node definition'
      console.warn(
        `Ignoring layout-only classification for "${normalizedNodeDef.name}": the ${executionShape} has outputs or is an output node.`
      )
      return { ...normalizedNodeDef, layout_only: false }
    }

    return normalizedNodeDef.layout_only === true
      ? normalizedNodeDef
      : { ...normalizedNodeDef, layout_only: true }
  })
}
