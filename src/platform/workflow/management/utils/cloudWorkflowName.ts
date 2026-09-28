import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

/**
 * The name to look a saved workflow up by in the Cloud library, derived from
 * its file name with `.app` kept. It is a lookup key, not a guaranteed Cloud
 * identity: Cloud may list a workflow in a subfolder under its folder path.
 */
export function cloudWorkflowName(workflow: ComfyWorkflow): string {
  return workflow.suffix === 'app.json'
    ? `${workflow.filename}.app`
    : workflow.filename
}
