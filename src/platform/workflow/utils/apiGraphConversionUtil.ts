import type { ComfyApiWorkflow } from '@comfyorg/api-to-workflow'
import {
  BundledObjectInfoProvider,
  convertApiToWorkflow
} from '@comfyorg/api-to-workflow'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

/**
 * Synthesizes a UI workflow from a stored API-format graph via the shared
 * `@comfyorg/api-to-workflow` converter — the same code the MCP server runs,
 * so the two conversions cannot drift.
 *
 * The result is reopenable but not faithful to any original canvas: layout is
 * invented and groups/reroutes do not survive API format. Node types missing
 * from the provided defs degrade that node's widget order and output slots
 * (the converter emits warnings rather than failing).
 */
export async function convertApiGraphToWorkflow(
  apiGraph: ComfyApiWorkflow,
  nodeDefs: Record<string, ComfyNodeDef>
): Promise<ComfyWorkflowJSON | null> {
  const provider = new BundledObjectInfoProvider(nodeDefs)
  const { workflow, warnings } = convertApiToWorkflow(apiGraph, provider)
  for (const warning of warnings) {
    console.warn('[convertApiGraphToWorkflow]', warning)
  }
  return await validateComfyWorkflow(workflow, (error) => {
    console.warn('[convertApiGraphToWorkflow] Validation failed:', error)
  })
}
