import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const baselineByWorkflowName = new Map<string, ComfyWorkflowJSON>()

const MAX_BASELINES = 32

function clone(workflow: ComfyWorkflowJSON): ComfyWorkflowJSON {
  return JSON.parse(JSON.stringify(workflow)) as ComfyWorkflowJSON
}

export function setTemplateBaseline(
  workflowName: string,
  workflow: ComfyWorkflowJSON
): void {
  if (!workflowName) return

  if (
    baselineByWorkflowName.size >= MAX_BASELINES &&
    !baselineByWorkflowName.has(workflowName)
  ) {
    const oldestKey = baselineByWorkflowName.keys().next().value
    if (oldestKey !== undefined) baselineByWorkflowName.delete(oldestKey)
  }

  baselineByWorkflowName.set(workflowName, clone(workflow))
}

export function getTemplateBaseline(
  workflowName: string
): ComfyWorkflowJSON | undefined {
  return baselineByWorkflowName.get(workflowName)
}

export function clearTemplateBaselines(): void {
  baselineByWorkflowName.clear()
}
