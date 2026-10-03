import type { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

/**
 * One scheduled WebSocket frame. Frames are built up front and sent by
 * {@link BackendSimulator.play}, so a test states the exact arrival order of
 * two prompts' messages instead of relying on timing.
 */
export interface Frame {
  /** `<workflow or job label>:<event type>` — used by the fault helpers. */
  label: string
  send: () => void
}

/**
 * A prompt the simulated backend is running. Every method returns a {@link Frame}
 * rather than sending immediately, and each frame carries this prompt's
 * `workflow_id` when one was given.
 */
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

  progress(nodeId: string, value: number, max: number): Frame {
    return this.frame('progress', () =>
      this.execution.progress(this.jobId, nodeId, value, max)
    )
  }

  nodeRunning(nodeId: string, value: number, max: number): Frame {
    return this.frame('progress_state', () =>
      this.execution.nodeRunning(this.jobId, nodeId, value, max)
    )
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

  error(nodeId: string, message: string): Frame {
    return this.frame('execution_error', () =>
      this.execution.executionError(this.jobId, nodeId, message)
    )
  }

  interrupted(nodeId: string): Frame {
    return this.frame('execution_interrupted', () =>
      this.execution.executionInterrupted(this.jobId, nodeId)
    )
  }

  latentPreview(nodeId: string): Frame {
    return this.frame('b_preview', () =>
      this.execution.latentPreview(this.jobId, nodeId)
    )
  }
}

/**
 * Scripts the WebSocket side of execution for one or more prompts.
 *
 * The bugs this exists for — node progress stuck after a run, progress from one
 * workflow tab landing on another, outputs applied to the wrong workflow — only
 * reproduce under specific frame orders, drops and overlaps. Hand-testing cannot
 * produce them reliably, so they are expressed as explicit frame scripts here.
 *
 * Socket drop/reconnect is not modelled: use `nextWebSocket` from the
 * `webSocketFixture` to arm a waiter, then close the current route.
 */
export class BackendSimulator {
  constructor(private readonly execution: ExecutionHelper) {}

  /**
   * Declare a prompt the backend is running. `jobId` is what
   * {@link ExecutionHelper.run} returned for the tab that submitted it.
   * Omit `workflowId` to emulate a core build that does not send metadata.
   */
  prompt(
    jobId: string,
    options: { workflowId?: string } = {}
  ): SimulatedPrompt {
    return new SimulatedPrompt(this.execution, jobId, options.workflowId)
  }

  /** Send frames in the given order. */
  play(frames: Frame[]): void {
    for (const frame of frames) frame.send()
  }
}

/** Remove every frame with this label — a backend that never sent it. */
export function dropFrames(frames: Frame[], label: string): Frame[] {
  return frames.filter((frame) => frame.label !== label)
}

/** Send a frame twice, as a retrying or reconnecting backend does. */
export function duplicateFrame(frames: Frame[], label: string): Frame[] {
  return frames.flatMap((frame) =>
    frame.label === label ? [frame, frame] : [frame]
  )
}

/** Swap two frames, producing out-of-order arrival. */
export function swapFrames(
  frames: Frame[],
  first: string,
  second: string
): Frame[] {
  const a = frames.findIndex((frame) => frame.label === first)
  const b = frames.findIndex((frame) => frame.label === second)
  if (a === -1 || b === -1) {
    throw new Error(`swapFrames: ${first} or ${second} is not in the script`)
  }
  const swapped = [...frames]
  ;[swapped[a], swapped[b]] = [swapped[b], swapped[a]]
  return swapped
}

/**
 * Deterministic interleave of two prompts' frames. `seed` selects the order, so
 * a failure is reproducible from the seed printed in the test name.
 */
export function interleave(a: Frame[], b: Frame[], seed: number): Frame[] {
  const out: Frame[] = []
  let state = seed
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    const takeA = j >= b.length || (i < a.length && state % 2 === 0)
    out.push(takeA ? a[i++] : b[j++])
  }
  return out
}
