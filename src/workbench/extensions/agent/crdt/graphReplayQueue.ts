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

/**
 * A link's endpoints, so the queue can reveal it alongside the node it
 * depends on rather than as a separate global pass. Endpoints outside this
 * batch (already on the graph before the batch started) are treated as
 * already-revealed - only endpoints the queue itself is pacing hold a link
 * back.
 */
export interface GraphReplayLink {
  id: string
  originId: string
  targetId: string
}

export interface GraphReplayBatch {
  nodeIds: readonly string[]
  links: readonly GraphReplayLink[]
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
  private pendingLinks: GraphReplayLink[] = []
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
    return new Set(this.pendingLinks.map((link) => link.id))
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
    const links = dedupeLinks(batch.links)
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

  /**
   * Links whose endpoints are all already revealed (not in `pendingNodeIds`
   * after removing `justRevealedNodes`) - these can go out in the same step
   * as the node(s) they depend on, or on their own once both ends are clear.
   */
  private releasableLinks(justRevealedNodes: ReadonlySet<string>): {
    releasable: GraphReplayLink[]
    held: GraphReplayLink[]
  } {
    const stillPendingNodes = new Set(this.pendingNodes)
    const releasable: GraphReplayLink[] = []
    const held: GraphReplayLink[] = []
    for (const link of this.pendingLinks) {
      const originPending =
        stillPendingNodes.has(link.originId) &&
        !justRevealedNodes.has(link.originId)
      const targetPending =
        stillPendingNodes.has(link.targetId) &&
        !justRevealedNodes.has(link.targetId)
      ;(originPending || targetPending ? held : releasable).push(link)
    }
    return { releasable, held }
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
    // Pace against nodes and HELD links only - a link that is already
    // releasable (both endpoints clear) rides out for free alongside the
    // node that just cleared it rather than competing for its own step, so
    // "revealed with its target node" means the same tick, not the next one.
    const { held: heldBefore } = this.releasableLinks(new Set())
    const total = this.pendingNodes.length + heldBefore.length
    if (total === 0) {
      // Only pre-releasable links remain (their endpoints cleared on an
      // earlier step but they missed that step's link budget) - flush them.
      if (this.pendingLinks.length > 0) this.emitStep([], this.pendingLinks)
      return
    }
    // Coalesce so the whole batch fits in maxTotalMs at stepMs per step:
    // this step plus however many more fit in the remaining budget.
    this.elapsedMs += this.stepMs
    const budgetLeft = Math.max(0, this.maxTotalMs - this.elapsedMs)
    const stepsLeft = 1 + Math.floor(budgetLeft / this.stepMs)
    const perStep = Math.max(1, Math.ceil(total / stepsLeft))
    const nodes = this.pendingNodes.slice(0, perStep)
    const { releasable } = this.releasableLinks(new Set(nodes))
    this.emitStep(nodes, releasable)
    if (this.pendingNodes.length + this.pendingLinks.length > 0) {
      this.scheduleNext()
    }
  }

  private emitStep(
    nodes: readonly string[],
    links: readonly GraphReplayLink[]
  ): void {
    const revealedNodes = new Set(nodes)
    const revealedLinkIds = new Set(links.map((link) => link.id))
    this.pendingNodes = this.pendingNodes.filter((id) => !revealedNodes.has(id))
    this.pendingLinks = this.pendingLinks.filter(
      (link) => !revealedLinkIds.has(link.id)
    )
    const missingNodeIds = nodes.filter((id) => !this.nodeExists(id))
    const linkIds = links.map((link) => link.id)
    this.onStep?.({ nodeIds: nodes, linkIds, missingNodeIds })
    const remaining = this.pendingNodes.length + this.pendingLinks.length
    if (missingNodeIds.length > 0) {
      // Honest failure: `nodeExists` (the caller's source of truth - the doc,
      // in the follower) no longer holds a node we were still pacing, so the
      // batch is stale. Force-reveal the rest so nothing stays veiled forever,
      // reporting any further missing ids in that step too.
      this.cancelTimer()
      const restNodes = this.pendingNodes
      const restLinks = this.pendingLinks
      this.pendingNodes = []
      this.pendingLinks = []
      if (restNodes.length + restLinks.length > 0) {
        this.onStep?.({
          nodeIds: restNodes,
          linkIds: restLinks.map((link) => link.id),
          missingNodeIds: restNodes.filter((id) => !this.nodeExists(id))
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

function dedupeLinks(links: readonly GraphReplayLink[]): GraphReplayLink[] {
  const seen = new Set<string>()
  const out: GraphReplayLink[] = []
  for (const link of links) {
    if (seen.has(link.id)) continue
    seen.add(link.id)
    out.push(link)
  }
  return out
}
