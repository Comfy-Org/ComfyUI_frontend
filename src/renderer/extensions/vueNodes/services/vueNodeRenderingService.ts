import type {
  VueNodeRenderArea,
  VueNodeRenderState,
  VueNodeRenderingApi,
  VueNodeRenderingContribution,
  VueNodeRenderingPolicy,
  VueNodeRenderingPolicyController,
  VueNodeRenderingPushController,
  VueNodeRenderingSnapshot
} from '@/types/vueNodeRendering'

interface RenderingNode {
  id: string
  renderArea: VueNodeRenderArea
}

interface RenderingRuntimeState {
  graph: object | null
  managerAvailable: boolean
  nodes: readonly RenderingNode[]
  visibleCanvasArea: VueNodeRenderArea | null
  frontendRequiredNodeIds: readonly string[]
  renderFrozen: boolean
}

interface NormalizedContribution {
  suppress: Set<string>
  retain: Set<string>
}

interface PushOwner {
  kind: 'push'
  contribution: NormalizedContribution
}

interface PolicyOwner {
  kind: 'policy'
  contribution: NormalizedContribution
  policy: VueNodeRenderingPolicy
}

type Owner = PushOwner | PolicyOwner

function emptyContribution(): NormalizedContribution {
  return {
    suppress: new Set<string>(),
    retain: new Set<string>()
  }
}

function freezeArea(
  area: VueNodeRenderArea,
  previous?: VueNodeRenderArea | null
): VueNodeRenderArea {
  if (previous && areAreasEqual(area, previous)) return previous
  return Object.freeze([area[0], area[1], area[2], area[3]])
}

function normalizeIds(
  ids: readonly (string | number)[] | undefined,
  knownNodeIds: ReadonlySet<string>
): Set<string> {
  const result = new Set<string>()
  for (const id of ids ?? []) {
    const normalized = String(id)
    if (knownNodeIds.has(normalized)) result.add(normalized)
  }
  return result
}

function normalizeContribution(
  contribution: VueNodeRenderingContribution,
  knownNodeIds: ReadonlySet<string>
): NormalizedContribution {
  return {
    suppress: normalizeIds(contribution.suppress, knownNodeIds),
    retain: normalizeIds(contribution.retain, knownNodeIds)
  }
}

function areArraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function freezeIds(
  ids: Iterable<string>,
  previous?: readonly string[]
): readonly string[] {
  const next = Array.from(ids)
  return previous && areArraysEqual(previous, next)
    ? previous
    : Object.freeze(next)
}

function areAreasEqual(
  a: VueNodeRenderArea | null,
  b: VueNodeRenderArea | null
): boolean {
  if (a === null || b === null) return a === b
  return a.every((value, index) => value === b[index])
}

function areRenderingNodesEqual(
  a: readonly RenderingNode[],
  b: readonly RenderingNode[]
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (node, index) =>
        node.id === b[index].id &&
        areAreasEqual(node.renderArea, b[index].renderArea)
    )
  )
}

function areSnapshotRenderAreasEqual(
  nodes: readonly RenderingNode[],
  renderAreas: VueNodeRenderingSnapshot['renderAreas']
): boolean {
  return (
    nodes.length === renderAreas.length &&
    nodes.every(
      (node, index) =>
        node.id === renderAreas[index].id &&
        areAreasEqual(node.renderArea, renderAreas[index].area)
    )
  )
}

function areSetsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}

function areContributionsEqual(
  a: NormalizedContribution,
  b: NormalizedContribution
): boolean {
  return (
    areSetsEqual(a.suppress, b.suppress) && areSetsEqual(a.retain, b.retain)
  )
}

export function createVueNodeRenderingService(): VueNodeRenderingApi & {
  updateRuntime(state: RenderingRuntimeState): void
  updateViewport(visibleCanvasArea: VueNodeRenderArea | null): void
  nodeMounted(id: string): void
  nodeUnmounted(id: string): void
} {
  let graph: object | null = null
  let graphRevision = 0
  let managerAvailable = false
  let nodes: readonly RenderingNode[] = []
  let nodeIdSet = new Set<string>()
  let visibleCanvasArea: VueNodeRenderArea | null = null
  let frontendRequiredNodeIds: readonly string[] = []
  let renderFrozen = false
  let renderedNodeIds = new Set<string>()
  const mountedNodeIds = new Set<string>()
  const initializedNodeIds = new Set<string>()
  const owners = new Map<string, Owner>()
  const listeners = new Set<(snapshot: VueNodeRenderingSnapshot) => void>()
  let evaluatingPolicies = false
  let mountRecomputeScheduled = false
  let snapshot = createSnapshot()

  function knownNodeIds(): ReadonlySet<string> {
    return nodeIdSet
  }

  function orderedSubset(ids: ReadonlySet<string>): string[] {
    return nodes.flatMap((node) => (ids.has(node.id) ? [node.id] : []))
  }

  function createSnapshot(
    previous?: VueNodeRenderingSnapshot
  ): VueNodeRenderingSnapshot {
    const suppressedIds = new Set(
      nodes
        .map((node) => node.id)
        .filter((nodeId) => !renderedNodeIds.has(nodeId))
    )

    return Object.freeze({
      graphRevision,
      managerAvailable,
      nodeIds: freezeIds(
        nodes.map((node) => node.id),
        previous?.nodeIds
      ),
      renderAreas:
        previous && areSnapshotRenderAreasEqual(nodes, previous.renderAreas)
          ? previous.renderAreas
          : Object.freeze(
              nodes.map((node) =>
                Object.freeze({
                  id: node.id,
                  area: node.renderArea
                })
              )
            ),
      visibleCanvasArea,
      renderedNodeIds: freezeIds(
        orderedSubset(renderedNodeIds),
        previous?.renderedNodeIds
      ),
      suppressedNodeIds: freezeIds(
        orderedSubset(suppressedIds),
        previous?.suppressedNodeIds
      ),
      mountedNodeIds: freezeIds(
        orderedSubset(mountedNodeIds),
        previous?.mountedNodeIds
      ),
      initializedNodeIds: freezeIds(
        orderedSubset(initializedNodeIds),
        previous?.initializedNodeIds
      ),
      frontendRequiredNodeIds: freezeIds(
        orderedSubset(new Set(frontendRequiredNodeIds)),
        previous?.frontendRequiredNodeIds
      ),
      renderFrozen,
      contributionOwners: freezeIds(owners.keys(), previous?.contributionOwners)
    })
  }

  function publish(nextSnapshot: VueNodeRenderingSnapshot): void {
    snapshot = nextSnapshot
    for (const listener of listeners) listener(snapshot)
  }

  function notify(): void {
    publish(createSnapshot(snapshot))
  }

  function notifyViewportChanged(): void {
    publish(Object.freeze({ ...snapshot, visibleCanvasArea }))
  }

  function pruneState(): void {
    const knownIds = knownNodeIds()
    for (const id of mountedNodeIds) {
      if (!knownIds.has(id)) mountedNodeIds.delete(id)
    }
    for (const id of initializedNodeIds) {
      if (!knownIds.has(id)) initializedNodeIds.delete(id)
    }
    for (const owner of owners.values()) {
      owner.contribution = normalizeContribution(
        {
          suppress: Array.from(owner.contribution.suppress),
          retain: Array.from(owner.contribution.retain)
        },
        knownIds
      )
    }
  }

  function desiredRenderedNodeIds(): Set<string> {
    const suppressed = new Set<string>()
    const retained = new Set<string>()
    for (const owner of owners.values()) {
      for (const id of owner.contribution.suppress) suppressed.add(id)
      for (const id of owner.contribution.retain) retained.add(id)
    }

    const required = new Set(frontendRequiredNodeIds)
    const result = new Set<string>()
    for (const node of nodes) {
      if (
        !suppressed.has(node.id) ||
        retained.has(node.id) ||
        required.has(node.id) ||
        !initializedNodeIds.has(node.id)
      ) {
        result.add(node.id)
      }
    }
    return result
  }

  function applyContributions(): void {
    const desired = desiredRenderedNodeIds()
    if (!renderFrozen) {
      if (!areSetsEqual(renderedNodeIds, desired)) renderedNodeIds = desired
      return
    }

    const knownIds = knownNodeIds()
    const nextRenderedNodeIds = new Set(
      [...renderedNodeIds, ...desired].filter((id) => knownIds.has(id))
    )
    if (!areSetsEqual(renderedNodeIds, nextRenderedNodeIds)) {
      renderedNodeIds = nextRenderedNodeIds
    }
  }

  function evaluatePolicies(): void {
    if (evaluatingPolicies) return
    evaluatingPolicies = true
    try {
      const knownIds = knownNodeIds()
      for (const [ownerName, owner] of owners) {
        if (owner.kind !== 'policy') continue
        try {
          owner.contribution = normalizeContribution(
            owner.policy(snapshot),
            knownIds
          )
        } catch (error) {
          owner.contribution = emptyContribution()
          console.error(
            `[Vue node rendering] Policy "${ownerName}" failed; rendering all nodes for this owner.`,
            error
          )
        }
      }
    } finally {
      evaluatingPolicies = false
    }
  }

  function hasPolicyOwner(): boolean {
    for (const owner of owners.values()) {
      if (owner.kind === 'policy') return true
    }
    return false
  }

  function recompute(): void {
    mountRecomputeScheduled = false
    pruneState()
    if (hasPolicyOwner()) snapshot = createSnapshot()
    evaluatePolicies()
    applyContributions()
    notify()
  }

  function scheduleMountRecompute(): void {
    if (mountRecomputeScheduled) return
    mountRecomputeScheduled = true
    queueMicrotask(() => {
      if (!mountRecomputeScheduled) return
      recompute()
    })
  }

  function assertOwnerAvailable(owner: string): void {
    if (!owner.trim())
      throw new Error('Vue node rendering owner must not be empty')
    if (owners.has(owner)) {
      throw new Error(
        `Vue node rendering owner "${owner}" is already registered`
      )
    }
  }

  function disposeOwner(owner: string, expected: Owner): void {
    if (owners.get(owner) !== expected) return
    owners.delete(owner)
    recompute()
  }

  function updateViewport(
    nextVisibleCanvasArea: VueNodeRenderArea | null
  ): void {
    if (areAreasEqual(visibleCanvasArea, nextVisibleCanvasArea)) return
    visibleCanvasArea = nextVisibleCanvasArea
      ? freezeArea(nextVisibleCanvasArea, visibleCanvasArea)
      : null
    if (hasPolicyOwner() || mountRecomputeScheduled) recompute()
    else notifyViewportChanged()
  }

  function updateRuntime(state: RenderingRuntimeState): void {
    const graphChanged = graph !== state.graph
    const nextRequired = Array.from(
      new Set(state.frontendRequiredNodeIds.map(String))
    )
    const nodesChanged = !areRenderingNodesEqual(nodes, state.nodes)
    const visibleCanvasAreaChanged = !areAreasEqual(
      visibleCanvasArea,
      state.visibleCanvasArea
    )
    const requiredNodeIdsChanged = !areArraysEqual(
      frontendRequiredNodeIds,
      nextRequired
    )
    const stateChanged =
      graphChanged ||
      managerAvailable !== state.managerAvailable ||
      nodesChanged ||
      visibleCanvasAreaChanged ||
      requiredNodeIdsChanged ||
      renderFrozen !== state.renderFrozen
    if (!stateChanged) return

    if (
      visibleCanvasAreaChanged &&
      !graphChanged &&
      managerAvailable === state.managerAvailable &&
      !nodesChanged &&
      !requiredNodeIdsChanged &&
      renderFrozen === state.renderFrozen
    ) {
      updateViewport(state.visibleCanvasArea)
      return
    }

    if (graphChanged) {
      graph = state.graph
      graphRevision += 1
      mountedNodeIds.clear()
      initializedNodeIds.clear()
      renderedNodeIds.clear()
      for (const owner of owners.values()) {
        if (owner.kind === 'push') owner.contribution = emptyContribution()
      }
    }
    managerAvailable = state.managerAvailable
    if (nodesChanged) {
      nodes = state.nodes.map((node, index) => ({
        id: node.id,
        renderArea: freezeArea(
          node.renderArea,
          nodes[index]?.id === node.id ? nodes[index].renderArea : undefined
        )
      }))
      nodeIdSet = new Set(nodes.map((node) => node.id))
    }
    if (visibleCanvasAreaChanged) {
      visibleCanvasArea = state.visibleCanvasArea
        ? freezeArea(state.visibleCanvasArea, visibleCanvasArea)
        : null
    }
    if (requiredNodeIdsChanged) frontendRequiredNodeIds = nextRequired
    renderFrozen = state.renderFrozen
    recompute()
  }

  function nodeMounted(id: string): void {
    if (!knownNodeIds().has(id)) return
    const changed = !mountedNodeIds.has(id) || !initializedNodeIds.has(id)
    mountedNodeIds.add(id)
    initializedNodeIds.add(id)
    if (changed) scheduleMountRecompute()
  }

  function nodeUnmounted(id: string): void {
    if (!mountedNodeIds.delete(id)) return
    scheduleMountRecompute()
  }

  function createPushController(
    ownerName: string
  ): VueNodeRenderingPushController {
    assertOwnerAvailable(ownerName)
    const owner: PushOwner = {
      kind: 'push',
      contribution: emptyContribution()
    }
    owners.set(ownerName, owner)
    recompute()

    return Object.freeze({
      update(contribution: VueNodeRenderingContribution) {
        if (owners.get(ownerName) !== owner) return
        const nextContribution = normalizeContribution(
          contribution,
          knownNodeIds()
        )
        if (areContributionsEqual(owner.contribution, nextContribution)) return
        owner.contribution = nextContribution
        recompute()
      },
      clear() {
        if (owners.get(ownerName) !== owner) return
        if (
          owner.contribution.suppress.size === 0 &&
          owner.contribution.retain.size === 0
        )
          return
        owner.contribution = emptyContribution()
        recompute()
      },
      dispose() {
        disposeOwner(ownerName, owner)
      }
    })
  }

  function createPolicyController(
    ownerName: string,
    policy: VueNodeRenderingPolicy
  ): VueNodeRenderingPolicyController {
    assertOwnerAvailable(ownerName)
    const owner: PolicyOwner = {
      kind: 'policy',
      contribution: emptyContribution(),
      policy
    }
    owners.set(ownerName, owner)
    recompute()

    return Object.freeze({
      invalidate() {
        if (owners.get(ownerName) !== owner) return
        recompute()
      },
      dispose() {
        disposeOwner(ownerName, owner)
      }
    })
  }

  return Object.freeze({
    getSnapshot: () => snapshot,
    getNodeRenderState(id: string | number): VueNodeRenderState {
      const normalized = String(id)
      if (!knownNodeIds().has(normalized)) return 'unknown'
      return renderedNodeIds.has(normalized) ? 'rendered' : 'suppressed'
    },
    subscribe(listener: (snapshot: VueNodeRenderingSnapshot) => void) {
      listeners.add(listener)
      listener(snapshot)
      return () => listeners.delete(listener)
    },
    createPushController,
    createPolicyController,
    updateRuntime,
    updateViewport,
    nodeMounted,
    nodeUnmounted
  })
}

export const vueNodeRenderingService = createVueNodeRenderingService()

export const vueNodeRenderingApi: VueNodeRenderingApi = Object.freeze({
  getSnapshot: vueNodeRenderingService.getSnapshot,
  getNodeRenderState: vueNodeRenderingService.getNodeRenderState,
  subscribe: vueNodeRenderingService.subscribe,
  createPushController: vueNodeRenderingService.createPushController,
  createPolicyController: vueNodeRenderingService.createPolicyController
})

export function isVueNodeRenderSuppressed(id: string): boolean {
  return vueNodeRenderingService.getNodeRenderState(id) === 'suppressed'
}
