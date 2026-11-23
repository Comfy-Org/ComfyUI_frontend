import type { CompatibilityModel } from '@comfyorg/ingest-types'

export interface CloudWorkflowGaps {
  nodePacks: string[]
  models: CompatibilityModel[]
}

export type CloudWorkflowVerdict =
  | { kind: 'canOpen'; workspaceId?: string }
  | { kind: 'missing'; gaps: CloudWorkflowGaps }

export type CloudWorkflowBlocker =
  | { kind: 'emptyWorkflow' }
  | { kind: 'unreadableModelLoader'; nodeType: string }

export type CloudWorkflowCheckResult =
  | CloudWorkflowVerdict
  | CloudWorkflowBlocker
  | null

export type CloudWorkflowCheckState =
  | { phase: 'idle' }
  | { phase: 'checking'; run: number }
  | { phase: 'failed'; blocker: CloudWorkflowBlocker | null }
  | { phase: 'answered'; verdict: CloudWorkflowVerdict }

export type CloudWorkflowCheckEvent =
  | { type: 'invalidated' }
  | { type: 'started'; run: number }
  | { type: 'failed'; run: number; blocker: CloudWorkflowBlocker | null }
  | { type: 'answered'; run: number; verdict: CloudWorkflowVerdict }

export function reduceCloudWorkflowCheck(
  state: CloudWorkflowCheckState,
  event: CloudWorkflowCheckEvent
): CloudWorkflowCheckState {
  switch (event.type) {
    case 'invalidated':
      return state.phase === 'idle' ? state : { phase: 'idle' }
    case 'started':
      return { phase: 'checking', run: event.run }
    case 'failed':
      return state.phase === 'checking' && state.run === event.run
        ? { phase: 'failed', blocker: event.blocker }
        : state
    case 'answered':
      return state.phase === 'checking' && state.run === event.run
        ? { phase: 'answered', verdict: event.verdict }
        : state
  }
}
