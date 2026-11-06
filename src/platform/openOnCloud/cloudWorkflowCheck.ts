export interface CloudMissingModel {
  name: string
  folder: string
}

export interface CloudWorkflowGaps {
  nodePacks: string[]
  models: CloudMissingModel[]
}

export type CloudWorkflowVerdict =
  | { kind: 'canOpen' }
  | { kind: 'missing'; gaps: CloudWorkflowGaps }

export type CloudWorkflowCheckState =
  | { phase: 'idle' }
  | { phase: 'checking'; run: number }
  | { phase: 'failed' }
  | { phase: 'answered'; verdict: CloudWorkflowVerdict }

export type CloudWorkflowCheckEvent =
  | { type: 'invalidated' }
  | { type: 'started'; run: number }
  | { type: 'failed'; run: number }
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
        ? { phase: 'failed' }
        : state
    case 'answered':
      return state.phase === 'checking' && state.run === event.run
        ? { phase: 'answered', verdict: event.verdict }
        : state
  }
}
