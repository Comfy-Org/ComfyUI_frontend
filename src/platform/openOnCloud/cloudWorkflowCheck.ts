import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

/** What Comfy Cloud lacks to run a workflow. */
interface CloudWorkflowGaps {
  nodePacks: string[]
  models: string[]
}

/** Comfy Cloud's answer to whether it can run a workflow. */
export type CloudWorkflowVerdict =
  | { kind: 'canOpen' }
  | { kind: 'missing'; gaps: CloudWorkflowGaps }
  | { kind: 'signedOut' }

/** Asks Comfy Cloud whether it can run a workflow. */
export type CloudWorkflowChecker = (
  workflow: ComfyWorkflowJSON
) => Promise<CloudWorkflowVerdict>

/** The check, and whether the modal for its answer opens or shows. */
export type CloudWorkflowCheckState =
  | { phase: 'idle' }
  | { phase: 'checking'; run: number; opensModal: boolean }
  | { phase: 'answered'; verdict: CloudWorkflowVerdict; showsModal: boolean }

export type CloudWorkflowCheckEvent =
  | { type: 'started'; run: number }
  | { type: 'answered'; run: number; verdict: CloudWorkflowVerdict }
  | { type: 'modalRequested' }
  | { type: 'modalDismissed' }

function wantsModal(state: CloudWorkflowCheckState): boolean {
  switch (state.phase) {
    case 'idle':
      return false
    case 'checking':
      return state.opensModal
    case 'answered':
      return state.showsModal
  }
}

function withModalRequested(
  state: CloudWorkflowCheckState
): CloudWorkflowCheckState {
  switch (state.phase) {
    case 'idle':
      return state
    case 'checking':
      return { ...state, opensModal: true }
    case 'answered':
      return { ...state, showsModal: true }
  }
}

/** An answer counts only for the check still running; a wanted modal waits for it. */
export function reduceCloudWorkflowCheck(
  state: CloudWorkflowCheckState,
  event: CloudWorkflowCheckEvent
): CloudWorkflowCheckState {
  switch (event.type) {
    case 'started':
      return {
        phase: 'checking',
        run: event.run,
        opensModal: wantsModal(state)
      }
    case 'answered':
      return state.phase === 'checking' && state.run === event.run
        ? {
            phase: 'answered',
            verdict: event.verdict,
            showsModal: state.opensModal
          }
        : state
    case 'modalRequested':
      return withModalRequested(state)
    case 'modalDismissed':
      return state.phase === 'answered'
        ? { ...state, showsModal: false }
        : state
  }
}

/** The answer the prototype switch has the stand-in checker give. */
export type PrototypeCloudCheck =
  | 'checking'
  | 'canOpen'
  | 'nodePacksMissing'
  | 'nodePacksAndModelsMissing'
  | 'signedOut'

export const PROTOTYPE_CHECK_MS = 1000

const PROTOTYPE_NODE_PACKS = ['rgthree-comfy', 'comfyui-impact-pack']

const PROTOTYPE_VERDICTS: Record<
  Exclude<PrototypeCloudCheck, 'checking'>,
  CloudWorkflowVerdict
> = {
  canOpen: { kind: 'canOpen' },
  nodePacksMissing: {
    kind: 'missing',
    gaps: { nodePacks: PROTOTYPE_NODE_PACKS, models: [] }
  },
  nodePacksAndModelsMissing: {
    kind: 'missing',
    gaps: { nodePacks: PROTOTYPE_NODE_PACKS, models: ['face_yolov8m.pt'] }
  },
  signedOut: { kind: 'signedOut' }
}

/**
 * Answers with what the prototype switch picks, after a pause; `checking`
 * never answers.
 */
export function prototypeCloudWorkflowChecker(
  pick: () => PrototypeCloudCheck
): CloudWorkflowChecker {
  return () => {
    const check = pick()
    if (check === 'checking') return new Promise(() => {})
    return new Promise((resolve) =>
      setTimeout(() => resolve(PROTOTYPE_VERDICTS[check]), PROTOTYPE_CHECK_MS)
    )
  }
}
