import type { MissingNodeType } from '@/types/comfy'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import { flattenWorkflowNodes } from '@/platform/workflow/core/utils/workflowFlattening'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { applyPublicationNodeTypes } from './selectedPublisherRevision'
import type { InstalledPublication } from './selectedPublisherRevision'
import type { WorkflowPackBinding } from './workflowPackCandidates'

export type RemappedPackNode = { sourceType: string; installedType: string }

export function remappedPackNodes(
  graph: ComfyWorkflowJSON,
  mapped: ComfyWorkflowJSON
) {
  const after = new Map(
    flattenWorkflowNodes(mapped).map((node) => [String(node.id), node])
  )
  const resolved = new Map<string, RemappedPackNode>()
  for (const node of flattenWorkflowNodes(graph)) {
    const replacement = after.get(String(node.id))
    if (
      replacement &&
      (replacement.type !== node.type ||
        replacement.properties?.cnr_id !== node.properties?.cnr_id ||
        replacement.properties?.ver !== node.properties?.ver)
    )
      resolved.set(String(node.id), {
        sourceType: node.type,
        installedType: replacement.type
      })
  }
  return resolved
}

export function remainingPackErrors(
  errors: readonly MissingNodeType[],
  graph: ComfyWorkflowJSON,
  publications: readonly InstalledPublication[],
  original: ComfyWorkflowJSON | undefined,
  bindings: readonly WorkflowPackBinding[]
): MissingNodeType[] {
  const mapped = applyPublicationNodeTypes(
    structuredClone(graph),
    publications,
    original,
    bindings
  )
  const resolved = remappedPackNodes(graph, mapped)
  return errors.filter((error) => {
    const type = typeof error === 'string' ? error : error.type
    if (typeof error !== 'string' && error.nodeId != null) {
      const id = tryNormalizeNodeExecutionId(error.nodeId)
      return !id || resolved.get(id)?.sourceType !== type
    }
    return true
  })
}
