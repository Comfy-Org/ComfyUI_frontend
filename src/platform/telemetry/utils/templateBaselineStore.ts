import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const baselineByWorkflowName = new Map<string, ComfyWorkflowJSON>()

export const MAX_BASELINES = 32

function clone(workflow: ComfyWorkflowJSON): ComfyWorkflowJSON {
  return JSON.parse(JSON.stringify(workflow)) as ComfyWorkflowJSON
}

export function setTemplateBaseline(
  workflowName: string,
  workflow: ComfyWorkflowJSON
): void {
  if (!workflowName) return

  if (baselineByWorkflowName.has(workflowName)) {
    baselineByWorkflowName.delete(workflowName)
  } else if (baselineByWorkflowName.size >= MAX_BASELINES) {
    const oldestKey = baselineByWorkflowName.keys().next().value
    if (oldestKey !== undefined) baselineByWorkflowName.delete(oldestKey)
  }

  baselineByWorkflowName.set(workflowName, clone(workflow))
}

export function getTemplateBaseline(
  workflowName: string
): ComfyWorkflowJSON | undefined {
  const baseline = baselineByWorkflowName.get(workflowName)
  return baseline ? clone(baseline) : undefined
}

export function clearTemplateBaselines(): void {
  baselineByWorkflowName.clear()
}
