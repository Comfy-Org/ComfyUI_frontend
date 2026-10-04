import type { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

/**
 * One scheduled WebSocket frame. Frames are built up front and sent by
 * {@link BackendSimulator.play}, so a test states the exact arrival order of
 * two prompts' messages instead of relying on timing.
 */
export interface Frame {
  /** `<workflow or job label>:<event type>` — used by the fault helpers. */
  label: string
  /**
   * The prompt that sent this frame. Two concurrent prompts of the *same*
   * workflow share a label, so a fault that must hit one of them selects on
   * this as well — see {@link FrameSelector}.
   */
  jobId: string
  send: () => void
}

/**
 * Which frames a fault applies to. A bare string keeps the workflow-wide
 * selection every script already uses; add `jobId` to reach one prompt when
 * several share a workflow id, and `occurrence` to reach one frame when a
 * single prompt sends the same event more than once.
 *
 * `occurrence` is 1-based and counts within whatever `label` (+ `jobId`) already
 * matched, so `{ label: 'wf-a:progress', occurrence: 2 }` is "the second
 * progress frame" — the shape behind *progress stuck after a run*, which needs
 * one of several identical events to go missing. Without it `label` + `jobId`
 * cannot tell two `progress` frames of one prompt apart, and one prompt sends
 * two of them as soon as a script uses both `progress()` and `nodeRunning()`.
 */
export type FrameSelector =
  | string
  | { label: string; jobId?: string; occurrence?: number }

function describeSelector(selector: FrameSelector): string {
  if (typeof selector === 'string') return selector
  const qualifiers = [
    selector.jobId === undefined ? undefined : `job ${selector.jobId}`,
    selector.occurrence === undefined
      ? undefined
      : `occurrence ${selector.occurrence}`
  ].filter((part) => part !== undefined)
  return qualifiers.length === 0
    ? selector.label
    : `${selector.label} (${qualifiers.join(', ')})`
}

function matchesLabelAndJob(frame: Frame, selector: FrameSelector): boolean {
  if (typeof selector === 'string') return frame.label === selector
  if (frame.label !== selector.label) return false
  return selector.jobId === undefined || frame.jobId === selector.jobId
}

function indicesOf(frames: Frame[], selector: FrameSelector): number[] {
  const found: number[] = []
  frames.forEach((frame, index) => {
    if (matchesLabelAndJob(frame, selector)) found.push(index)
  })
  if (typeof selector === 'string' || selector.occurrence === undefined) {
    return found
  }
  if (selector.occurrence < 1 || !Number.isInteger(selector.occurrence)) {
    throw new Error(
      `occurrence must be a positive integer, got ${selector.occurrence}`
    )
  }
  // `.at` rather than an index, so an occurrence past the end is `undefined`
  // and falls through to `requireMatches` instead of being a hole in the array.
  // The positive-integer check above is what keeps this from wrapping.
  const picked = found.at(selector.occurrence - 1)
  return picked === undefined ? [] : [picked]
}

/**
 * A fault that silently matches nothing is a test that silently stops
 * exercising its fault, so every helper fails loudly instead.
 */
function requireMatches(
  frames: Frame[],
  selector: FrameSelector,
  helper: string
): number[] {
  const found = indicesOf(frames, selector)
  if (found.length === 0) {
    throw new Error(
      `${helper}: ${describeSelector(selector)} is not in the script`
    )
  }
  return found
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
      jobId: this.jobId,
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

  /**
   * The two frames a running node produces — `progress_state`, then `progress`.
   *
   * Returned as two {@link Frame}s rather than one because a Frame is one
   * WebSocket frame. A single Frame that sent both would make the `progress`
   * half unreachable to every fault helper (no Frame carries its label, so
   * `dropFrames(script, 'wf:progress')` would throw `not in the script` while a
   * `progress` frame was in fact on the wire), would force a drop or duplicate
   * of one half to hit both, and would make {@link interleave} schedule fewer
   * units than it emits. Spread it into a script:
   * `[p.start(), ...p.nodeRunning('1', 1, 4)]`.
   */
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

  /**
   * The binary preview frame. Labelled `b_preview_with_metadata`, which is the
   * event `api.ts` dispatches for the type-4 message this sends; the `b_preview`
   * it also dispatches is a back-compat alias, and labelling the frame with the
   * alias made the primary event name unselectable.
   */
  latentPreview(nodeId: string): Frame {
    return this.frame('b_preview_with_metadata', () =>
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

/**
 * Remove every selected frame — a backend that never sent it. Pass a `jobId` to
 * drop one prompt's frame while a concurrent prompt of the same workflow keeps
 * its own.
 */
export function dropFrames(frames: Frame[], selector: FrameSelector): Frame[] {
  const drop = new Set(requireMatches(frames, selector, 'dropFrames'))
  return frames.filter((_, index) => !drop.has(index))
}

/**
 * Send selected frames twice, as a retrying or reconnecting backend does.
 *
 * Plural like {@link dropFrames}: every match is duplicated, so a bare label
 * matching two prompts injects a wider fault than a test naming one frame
 * probably means. Narrow it with `jobId`/`occurrence` when that matters.
 */
export function duplicateFrames(
  frames: Frame[],
  selector: FrameSelector
): Frame[] {
  const duplicate = new Set(requireMatches(frames, selector, 'duplicateFrames'))
  return frames.flatMap((frame, index) =>
    duplicate.has(index) ? [frame, frame] : [frame]
  )
}

/**
 * Swap two frames, producing out-of-order arrival.
 *
 * Each selector must identify exactly one frame, and the two must not be the
 * same frame. A swap is a pair operation, so quietly taking the first of several
 * matches is how a two-prompt script ends up reordering the wrong prompt's
 * frame; add a `jobId` or an `occurrence` to disambiguate. Swapping a frame with
 * itself is the same silent no-fault that {@link requireMatches} exists to rule
 * out, so it throws rather than returning the script unchanged.
 */
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
        `swapFrames: ${describeSelector(selector)} matches ${found.length} frames; ` +
          'add a jobId (different prompts) or an occurrence (same prompt, ' +
          'repeated event) to select one'
      )
    }
  }
  if (a[0] === b[0]) {
    throw new Error(
      `swapFrames: ${describeSelector(first)} and ${describeSelector(second)} ` +
        'select the same frame; swapping it with itself applies no fault'
    )
  }
  const swapped = [...frames]
  ;[swapped[a[0]], swapped[b[0]]] = [swapped[b[0]], swapped[a[0]]]
  return swapped
}

/**
 * Deterministic interleave of two prompts' frames. `seed` selects the order, so
 * a failure is reproducible from the seed printed in the test name.
 *
 * Each input's own order is preserved — frames of one prompt never arrive out of
 * dependency order relative to each other, only relative to the other prompt's.
 *
 * The result is guaranteed to **overlap**: neither prompt's script finishes
 * before the other's starts, so the two runs are genuinely concurrent. Without
 * that guarantee a schedule can come out sequential and a concurrency spec
 * passes without ever having two prompts in flight. (A one-frame-each pair
 * cannot overlap; everything larger does.)
 *
 * An empty input throws. Both forcing rules below are gated on the other side
 * being non-empty, so an empty side would return the other script verbatim with
 * no overlap at all — the same silent degradation to no-fault that
 * {@link requireMatches} refuses, and with the same consequence: a concurrency
 * spec passing having never been concurrent.
 */
export function interleave(a: Frame[], b: Frame[], seed: number): Frame[] {
  if (a.length === 0 || b.length === 0) {
    throw new Error(
      `interleave: needs frames on both sides to overlap, got ${a.length} and ${b.length}`
    )
  }
  const out: Frame[] = []
  let state = seed | 0
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    // Exact 32-bit arithmetic. `state * 1103515245` exceeds 2^53 as a double,
    // so a plain multiply rounds the low bits away: every seed then produced
    // the same constant coin and the helper emitted all of `a` before any of
    // `b`. `Math.imul` is the multiply that does not lose them.
    state = (Math.imul(state, 1103515245) + 12345) | 0
    // Bit 0 of a power-of-two-modulus LCG flips on every step whatever the
    // seed, which would make the schedule a fixed A/B/A/B. Take a high bit.
    let takeA = j >= b.length || (i < a.length && ((state >>> 16) & 1) === 0)
    // Overlap guarantee, in two symmetric rules: do not emit one prompt's last
    // frame while the other has not started.
    if (takeA && b.length > 0 && j === 0 && i === a.length - 1) takeA = false
    else if (!takeA && a.length > 0 && i === 0 && j === b.length - 1)
      takeA = true
    out.push(takeA ? a[i++] : b[j++])
  }
  return out
}
