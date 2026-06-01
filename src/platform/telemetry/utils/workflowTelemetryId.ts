import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

/**
 * Stable id used to attribute telemetry to a workflow/app. Mirrors the id
 * execution events report (active state, falling back to initial state) so
 * created and opened events can be joined to runs of the same workflow.
 */
export function workflowTelemetryId(
  workflow: ComfyWorkflow | null | undefined
): string | undefined {
  return workflow?.activeState?.id ?? workflow?.initialState?.id
}
