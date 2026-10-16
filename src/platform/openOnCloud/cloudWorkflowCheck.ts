import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

/** What Comfy Cloud lacks to run a workflow. */
export interface CloudWorkflowGaps {
  nodeTypes: string[]
  models: string[]
}

/** Comfy Cloud's answer to whether it can run a workflow. */
export type CloudWorkflowVerdict =
  | { kind: 'canOpen' }
  | { kind: 'missing'; gaps: CloudWorkflowGaps }

/** Asks Comfy Cloud whether it can run a workflow. */
export type CloudWorkflowChecker = (
  workflow: ComfyWorkflowJSON
) => Promise<CloudWorkflowVerdict>

export type CloudWorkflowCheckState =
  | { phase: 'idle' }
  | { phase: 'checking'; run: number }
  | { phase: 'answered'; verdict: CloudWorkflowVerdict }

export type CloudWorkflowCheckEvent =
  | { type: 'started'; run: number }
  | { type: 'answered'; run: number; verdict: CloudWorkflowVerdict }

/** An answer counts only for the check still running. */
export function reduceCloudWorkflowCheck(
  state: CloudWorkflowCheckState,
  event: CloudWorkflowCheckEvent
): CloudWorkflowCheckState {
  switch (event.type) {
    case 'started':
      return { phase: 'checking', run: event.run }
    case 'answered':
      return state.phase === 'checking' && state.run === event.run
        ? { phase: 'answered', verdict: event.verdict }
        : state
  }
}

/** The answer the prototype switch has the stand-in checker give. */
export type PrototypeCloudCheck = 'checking' | CloudWorkflowVerdict['kind']

export const PROTOTYPE_CHECK_MS = 1000

export const PROTOTYPE_GAPS: CloudWorkflowGaps = {
  nodeTypes: ['UltimateSDUpscale'],
  models: []
}

function prototypeVerdict(
  check: Exclude<PrototypeCloudCheck, 'checking'>
): CloudWorkflowVerdict {
  return check === 'canOpen'
    ? { kind: 'canOpen' }
    : { kind: 'missing', gaps: PROTOTYPE_GAPS }
}

/**
 * Stands in for the backend check until it ships: answers with what the
 * prototype switch picks, after a pause. `checking` never answers.
 */
export function prototypeCloudWorkflowChecker(
  pick: () => PrototypeCloudCheck
): CloudWorkflowChecker {
  return () => {
    const check = pick()
    if (check === 'checking') return new Promise(() => {})
    return new Promise((resolve) =>
      setTimeout(() => resolve(prototypeVerdict(check)), PROTOTYPE_CHECK_MS)
    )
  }
}
