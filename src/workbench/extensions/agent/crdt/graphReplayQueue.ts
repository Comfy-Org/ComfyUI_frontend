/**
 * Presentation-only replay queue for agent-authored graph changes (Option B,
 * bbc #285). The canonical CRDT frame has ALREADY been applied by the time a
 * batch is enqueued; this queue only paces the *reveal* of the new node and
 * link ids so a follower can watch the agent's edit unfold instead of seeing
 * the whole graph pop in at once. It never touches the graph or the doc.
 */

export type GraphReplayState =
  | 'idle'
  | 'loading'
  | 'partial'
  | 'failed'
  | 'complete'

export interface GraphReplayBatch {
  nodeIds: readonly string[]
  linkIds: readonly string[]
}

export interface GraphReplayStep {
  nodeIds: readonly string[]
  linkIds: readonly string[]
  /** Ids the queue could not resolve on the graph; forces `failed`. */
  missingNodeIds: readonly string[]
}

export interface GraphReplayQueueOptions {
  /** Delay between reveal steps. Clamped to [MIN_STEP_MS, MAX_STEP_MS]. */
  stepMs?: number
  /** Hard cap on the total wall-clock duration of one batch. */
  maxTotalMs?: number
  /** Returns false when the node no longer exists on the graph. */
  nodeExists?: (id: string) => boolean
  onStep?: (step: GraphReplayStep) => void
  onStateChange?: (state: GraphReplayState) => void
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void
}

const MIN_STEP_MS = 120
const MAX_STEP_MS = 250
const DEFAULT_MAX_TOTAL_MS = 2000

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

export class GraphReplayQueue {
  private state: GraphReplayState = 'idle'
  private pendingNodes: string[] = []
  private pendingLinks: string[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  /** Wall-clock ms consumed by the current batch's reveal steps. */
  private elapsedMs = 0
  private readonly stepMs: number
  private readonly maxTotalMs: number
  private readonly nodeExists: (id: string) => boolean
  private readonly onStep: ((step: GraphReplayStep) => void) | undefined
  private readonly onStateChange:
    | ((state: GraphReplayState) => void)
    | undefined
  private readonly schedule: (
    fn: () => void,
    ms: number
  ) => ReturnType<typeof setTimeout>
  private readonly unschedule: (handle: ReturnType<typeof setTimeout>) => void

  constructor(options: GraphReplayQueueOptions = {}) {
    this.stepMs = clamp(options.stepMs ?? MIN_STEP_MS, MIN_STEP_MS, MAX_STEP_MS)
    this.maxTotalMs = options.maxTotalMs ?? DEFAULT_MAX_TOTAL_MS
    this.nodeExists = options.nodeExists ?? (() => true)
    this.onStep = options.onStep
    this.onStateChange = options.onStateChange
    this.schedule = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms))
    this.unschedule = options.clearTimeout ?? ((h) => clearTimeout(h))
  }

  get currentState(): GraphReplayState {
    return this.state
  }

  /** Node ids that have been applied canonically but not yet revealed. */
  get pendingNodeIds(): ReadonlySet<string> {
    return new Set(this.pendingNodes)
  }

  get pendingLinkIds(): ReadonlySet<string> {
    return new Set(this.pendingLinks)
  }

  /**
   * Start pacing a new batch. Any in-flight batch is fast-forwarded first so
   * the follower never sees stale veils from a superseded edit.
   */
  enqueueBatch(batch: GraphReplayBatch): void {
    if (this.pendingNodes.length > 0 || this.pendingLinks.length > 0) {
      this.fastForward()
    }
    const nodes = dedupe(batch.nodeIds)
    const links = dedupe(batch.linkIds)
    if (nodes.length === 0 && links.length === 0) return
    this.pendingNodes = nodes
    this.pendingLinks = links
    this.elapsedMs = 0
    this.setState('loading')
    this.scheduleNext()
  }

  /** Reveal everything that is still pending in one step. */
  fastForward(): void {
    this.cancelTimer()
    if (this.pendingNodes.length === 0 && this.pendingLinks.length === 0) return
    this.emitStep(this.pendingNodes, this.pendingLinks)
  }

  /** Drop all pending work without revealing anything (teardown). */
  clear(): void {
    this.cancelTimer()
    this.pendingNodes = []
    this.pendingLinks = []
    this.setState('idle')
  }

  private scheduleNext(): void {
    this.cancelTimer()
    this.timer = this.schedule(() => {
      this.timer = null
      this.tick()
    }, this.stepMs)
  }

  private tick(): void {
    const total = this.pendingNodes.length + this.pendingLinks.length
    if (total === 0) return
    // Coalesce so the whole batch fits in maxTotalMs at stepMs per step:
    // this step plus however many more fit in the remaining budget.
    this.elapsedMs += this.stepMs
    const budgetLeft = Math.max(0, this.maxTotalMs - this.elapsedMs)
    const stepsLeft = 1 + Math.floor(budgetLeft / this.stepMs)
    const perStep = Math.max(1, Math.ceil(total / stepsLeft))
    // Nodes reveal before links: a link with an unrevealed endpoint is noise.
    const nodes = this.pendingNodes.slice(0, perStep)
    const links =
      nodes.length < perStep
        ? this.pendingLinks.slice(0, perStep - nodes.length)
        : []
    this.emitStep(nodes, links)
    if (this.pendingNodes.length + this.pendingLinks.length > 0) {
      this.scheduleNext()
    }
  }

  private emitStep(nodes: readonly string[], links: readonly string[]): void {
    const revealedNodes = new Set(nodes)
    const revealedLinks = new Set(links)
    this.pendingNodes = this.pendingNodes.filter((id) => !revealedNodes.has(id))
    this.pendingLinks = this.pendingLinks.filter((id) => !revealedLinks.has(id))
    const missingNodeIds = nodes.filter((id) => !this.nodeExists(id))
    this.onStep?.({ nodeIds: nodes, linkIds: links, missingNodeIds })
    const remaining = this.pendingNodes.length + this.pendingLinks.length
    if (missingNodeIds.length > 0) {
      // Honest failure: the graph no longer matches the batch we were pacing.
      // Force-reveal the rest so nothing stays veiled forever.
      this.cancelTimer()
      const restNodes = this.pendingNodes
      const restLinks = this.pendingLinks
      this.pendingNodes = []
      this.pendingLinks = []
      if (restNodes.length + restLinks.length > 0) {
        this.onStep?.({
          nodeIds: restNodes,
          linkIds: restLinks,
          missingNodeIds: []
        })
      }
      this.setState('failed')
      return
    }
    this.setState(remaining === 0 ? 'complete' : 'partial')
  }

  private setState(next: GraphReplayState): void {
    if (this.state === next) return
    this.state = next
    this.onStateChange?.(next)
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      this.unschedule(this.timer)
      this.timer = null
    }
  }
}

function dedupe(ids: readonly string[]): string[] {
  return Array.from(new Set(ids))
}
