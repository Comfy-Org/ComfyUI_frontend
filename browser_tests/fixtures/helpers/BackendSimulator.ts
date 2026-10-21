import type { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

export interface Frame {
  readonly label: string
  readonly send: () => void
}

export type FrameSelector = string

function indicesOf(frames: Frame[], selector: FrameSelector): number[] {
  return frames.flatMap((frame, index) =>
    frame.label === selector ? [index] : []
  )
}

function requireMatches(
  frames: Frame[],
  selector: FrameSelector,
  helper: string
): number[] {
  const found = indicesOf(frames, selector)
  if (found.length === 0) {
    throw new Error(`${helper}: ${selector} is not in the script`)
  }
  return found
}

export class SimulatedPrompt {
  constructor(
    private readonly execution: ExecutionHelper,
    readonly jobId: string,
    readonly workflowId?: string
  ) {}

  private frame(type: string, send: () => void): Frame {
    return {
      label: `${this.workflowId ?? this.jobId}:${type}`,
      send: () => this.execution.withWorkflowId(this.workflowId, send)
    }
  }

  start(): Frame {
    return this.frame('execution_start', () =>
      this.execution.executionStart(this.jobId)
    )
  }

  executing(nodeId: string | null): Frame {
    return this.frame('executing', () =>
      this.execution.executing(this.jobId, nodeId)
    )
  }

  nodeRunning(nodeId: string, value: number, max: number): [Frame, Frame] {
    return [
      this.frame('progress_state', () =>
        this.execution.progressState(
          this.jobId,
          this.execution.runningNodeState(this.jobId, nodeId, value, max)
        )
      ),
      this.frame('progress', () =>
        this.execution.progress(this.jobId, nodeId, value, max)
      )
    ]
  }

  executed(
    nodeId: string,
    output: Record<string, unknown> | null | undefined
  ): Frame {
    return this.frame('executed', () =>
      this.execution.executed(this.jobId, nodeId, output)
    )
  }

  success(): Frame {
    return this.frame('execution_success', () =>
      this.execution.executionSuccess(this.jobId)
    )
  }

  latentPreview(nodeId: string): Frame {
    return this.frame('b_preview_with_metadata', () =>
      this.execution.latentPreview(this.jobId, nodeId)
    )
  }
}

export class BackendSimulator {
  constructor(private readonly execution: ExecutionHelper) {}

  prompt(
    jobId: string,
    options: { workflowId?: string } = {}
  ): SimulatedPrompt {
    return new SimulatedPrompt(this.execution, jobId, options.workflowId)
  }

  play(frames: Frame[]): void {
    for (const frame of frames) frame.send()
  }
}

export function dropFrames(frames: Frame[], selector: FrameSelector): Frame[] {
  const drop = new Set(requireMatches(frames, selector, 'dropFrames'))
  return frames.filter((_, index) => !drop.has(index))
}

export function duplicateFrames(
  frames: Frame[],
  selector: FrameSelector
): Frame[] {
  const duplicate = new Set(requireMatches(frames, selector, 'duplicateFrames'))
  return frames.flatMap((frame, index) =>
    duplicate.has(index) ? [frame, frame] : [frame]
  )
}

export function swapFrames(
  frames: Frame[],
  first: FrameSelector,
  second: FrameSelector
): Frame[] {
  const a = requireMatches(frames, first, 'swapFrames')
  const b = requireMatches(frames, second, 'swapFrames')
  for (const [selector, found] of [
    [first, a],
    [second, b]
  ] as const) {
    if (found.length > 1) {
      throw new Error(
        `swapFrames: ${selector} matches ${found.length} frames; ` +
          'pick a label that matches exactly one frame'
      )
    }
  }
  if (a[0] === b[0]) {
    throw new Error(
      `swapFrames: ${first} and ${second} ` +
        'select the same frame; swapping it with itself applies no fault'
    )
  }
  const swapped = [...frames]
  ;[swapped[a[0]], swapped[b[0]]] = [swapped[b[0]], swapped[a[0]]]
  return swapped
}

export function interleave(a: Frame[], b: Frame[], seed: number): Frame[] {
  if (!Number.isInteger(seed) || seed !== (seed | 0)) {
    throw new Error(
      `interleave: seed must be a signed 32-bit integer, got ${seed}`
    )
  }
  if (a.length === 0 || b.length === 0 || a.length + b.length < 3) {
    throw new Error(
      `interleave: needs frames on both sides and at least three in total to overlap, got ${a.length} and ${b.length}`
    )
  }
  const out: Frame[] = []
  let state = seed | 0
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    // Math.imul: the plain product exceeds 2^53 and rounds the low bits away.
    state = (Math.imul(state, 1103515245) + 12345) | 0
    let takeA = j >= b.length || (i < a.length && ((state >>> 16) & 1) === 0)
    if (takeA && b.length > 0 && j === 0 && i === a.length - 1) takeA = false
    else if (!takeA && a.length > 0 && i === 0 && j === b.length - 1)
      takeA = true
    out.push(takeA ? a[i++] : b[j++])
  }
  return out
}
