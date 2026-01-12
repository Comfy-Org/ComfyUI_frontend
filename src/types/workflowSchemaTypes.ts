import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * ComfyWorkflowJSON and ISerialisedGraph are structurally compatible
 * at runtime. This type alias documents the intentional cast between them.
 *
 * ComfyWorkflowJSON is the Zod-validated workflow schema from the frontend.
 * ISerialisedGraph is the LiteGraph serialization format.
 *
 * TODO: Align these schemas to eliminate the need for this cast.
 * @see https://github.com/Comfy-Org/ComfyUI_frontend/issues/XXXX
 */
export type WorkflowAsGraph = ComfyWorkflowJSON & ISerialisedGraph
