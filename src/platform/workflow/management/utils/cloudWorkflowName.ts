import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

/** The name Cloud lists a saved workflow under: the file name, `.app` kept. */
export function cloudWorkflowName(workflow: ComfyWorkflow): string {
  return workflow.suffix === 'app.json'
    ? `${workflow.filename}.app`
    : workflow.filename
}
