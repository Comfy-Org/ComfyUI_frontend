import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { resolveRoles } from './roleResolver'
import type { NodeDefLookup } from './roleResolver'
import type { ResolvedRoles } from './tourSequence'

/** Output types that mark a registry sink as producing video rather than an image. */
const VIDEO_OUTPUT_TYPES = new Set(['VIDEO', 'VHS_VIDEOINFO'])

/** Reads the node registry so the resolver can widen sink detection to custom output nodes. */
const nodeDefLookup: NodeDefLookup = (type) => {
  const defs = useNodeDefStore().nodeDefsByName
  if (!Object.hasOwn(defs, type)) return null
  const def = defs[type]
  return {
    isOutputNode: def.output_node,
    producesVideo: def.outputs.some((output) =>
      VIDEO_OUTPUT_TYPES.has(output.type)
    )
  }
}

/**
 * Resolve tour roles with the live node registry injected, so registry-only
 * custom sinks are detected. The single entry point the store and the readiness
 * gate share, so both see the same roles (the gate reads the live graph the
 * spotlight reads — they must not diverge on which sink exists).
 */
export function resolveTourRoles(
  workflow: ComfyWorkflowJSON,
  templateId?: string
): ResolvedRoles {
  return resolveRoles(workflow, templateId, nodeDefLookup)
}
