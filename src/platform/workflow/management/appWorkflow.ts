import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

export function isAppWorkflow(
  workflow: Pick<ComfyWorkflow, 'suffix'>
): boolean {
  return workflow.suffix === 'app.json'
}
