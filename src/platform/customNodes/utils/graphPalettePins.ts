import type { CloudNodeRegistry } from '@comfyorg/ingest-types'

import { flattenWorkflowNodes } from '@/platform/workflow/core/utils/workflowFlattening'
import type { FlattenableWorkflowGraph } from '@/platform/workflow/core/utils/workflowFlattening'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export type GraphPaletteDefinitions = Record<
  string,
  Pick<ComfyNodeDef, 'python_module' | 'comfy_cloud_palette_visible'>
>

export function graphPalettePinPlan(
  graph: FlattenableWorkflowGraph,
  catalog: CloudNodeRegistry,
  definitions: GraphPaletteDefinitions
) {
  const revisionIds = new Set<string>()
  const unresolved = new Set<string>()
  const types = new Set(flattenWorkflowNodes(graph).map((node) => node.type))
  for (const type of types) {
    const definition = definitions[type]
    if (
      definition &&
      !definition.python_module.startsWith('custom_nodes.cloud_registry.')
    )
      continue
    const candidates = catalog.revisions.filter(
      (revision) =>
        revision.nodes.includes(type) && revision.node_api_version === 2
    )
    if (!candidates.length || candidates.some((revision) => revision.pinned))
      continue
    const eligible = candidates.filter((revision) => revision.upstream_commit)
    const exactId = definition?.python_module.slice(
      'custom_nodes.cloud_registry.'.length
    )
    const exact = eligible.find((revision) => revision.revision_id === exactId)
    const chosen = exact ?? (eligible.length === 1 ? eligible[0] : undefined)
    if (chosen) revisionIds.add(chosen.revision_id)
    else unresolved.add(type)
  }
  return { revisionIds: [...revisionIds], unresolved: [...unresolved] }
}
