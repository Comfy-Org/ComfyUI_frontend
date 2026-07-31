export type VueNodeRenderState = 'rendered' | 'suppressed' | 'unknown'

export type VueNodeRenderArea = readonly [
  x: number,
  y: number,
  width: number,
  height: number
]

interface VueNodeRenderAreaSnapshot {
  readonly id: string
  readonly area: VueNodeRenderArea
}

export interface VueNodeRenderingSnapshot {
  /** Increments whenever the active graph instance changes. */
  readonly graphRevision: number
  readonly managerAvailable: boolean
  readonly nodeIds: readonly string[]
  readonly renderAreas: readonly VueNodeRenderAreaSnapshot[]
  readonly visibleCanvasArea: VueNodeRenderArea | null
  readonly renderedNodeIds: readonly string[]
  readonly suppressedNodeIds: readonly string[]
  readonly mountedNodeIds: readonly string[]
  readonly initializedNodeIds: readonly string[]
  readonly frontendRequiredNodeIds: readonly string[]
  readonly renderFrozen: boolean
  readonly contributionOwners: readonly string[]
}

export interface VueNodeRenderingContribution {
  readonly suppress?: readonly (string | number)[]
  readonly retain?: readonly (string | number)[]
}

export interface VueNodeRenderingPushController {
  /** Replaces this owner's previous contribution. Unknown IDs are ignored. */
  update(contribution: VueNodeRenderingContribution): void
  /** Removes this owner's contribution without unregistering the owner. */
  clear(): void
  /** Removes this owner and makes the controller inert. */
  dispose(): void
}

export interface VueNodeRenderingPolicyController {
  /** Re-evaluates the policy even when the runtime snapshot has not changed. */
  invalidate(): void
  /** Removes this owner and makes the controller inert. */
  dispose(): void
}

export type VueNodeRenderingPolicy = (
  snapshot: VueNodeRenderingSnapshot
) => VueNodeRenderingContribution

export interface VueNodeRenderingApi {
  getSnapshot(): VueNodeRenderingSnapshot
  getNodeRenderState(id: string | number): VueNodeRenderState
  /** Subscribes to snapshots and immediately invokes the listener once. */
  subscribe(listener: (snapshot: VueNodeRenderingSnapshot) => void): () => void
  /** Registers an owner whose contribution resets when the graph changes. */
  createPushController(owner: string): VueNodeRenderingPushController
  /** Registers a uniquely named owner derived from immutable snapshots. */
  createPolicyController(
    owner: string,
    policy: VueNodeRenderingPolicy
  ): VueNodeRenderingPolicyController
}
