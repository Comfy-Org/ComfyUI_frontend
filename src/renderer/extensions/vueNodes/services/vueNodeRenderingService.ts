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

function freezeArea(area: VueNodeRenderArea): VueNodeRenderArea {
  return Object.freeze([area[0], area[1], area[2], area[3]])
}

function freezeIds(ids: Iterable<string>): readonly string[] {
  return Object.freeze(Array.from(ids))
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

export function createVueNodeRenderingService(): VueNodeRenderingApi & {
  updateRuntime(state: RenderingRuntimeState): void
  nodeMounted(id: string): void
  nodeUnmounted(id: string): void
} {
  let graph: object | null = null
  let graphRevision = 0
  let managerAvailable = false
  let nodes: readonly RenderingNode[] = []
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

  function knownNodeIds(): Set<string> {
    return new Set(nodes.map((node) => node.id))
  }

  function orderedSubset(ids: ReadonlySet<string>): string[] {
    return nodes.flatMap((node) => (ids.has(node.id) ? [node.id] : []))
  }

  function createSnapshot(): VueNodeRenderingSnapshot {
    const suppressedIds = new Set(
      nodes
        .map((node) => node.id)
        .filter((nodeId) => !renderedNodeIds.has(nodeId))
    )

    return Object.freeze({
      graphRevision,
      managerAvailable,
      nodeIds: freezeIds(nodes.map((node) => node.id)),
      renderAreas: Object.freeze(
        nodes.map((node) =>
          Object.freeze({
            id: node.id,
            area: freezeArea(node.renderArea)
          })
        )
      ),
      visibleCanvasArea: visibleCanvasArea
        ? freezeArea(visibleCanvasArea)
        : null,
      renderedNodeIds: freezeIds(orderedSubset(renderedNodeIds)),
      suppressedNodeIds: freezeIds(orderedSubset(suppressedIds)),
      mountedNodeIds: freezeIds(orderedSubset(mountedNodeIds)),
      initializedNodeIds: freezeIds(orderedSubset(initializedNodeIds)),
      frontendRequiredNodeIds: freezeIds(
        orderedSubset(new Set(frontendRequiredNodeIds))
      ),
      renderFrozen,
      contributionOwners: freezeIds(owners.keys())
    })
  }

  function notify(): void {
    snapshot = createSnapshot()
    for (const listener of listeners) listener(snapshot)
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
      renderedNodeIds = desired
      return
    }

    const knownIds = knownNodeIds()
    renderedNodeIds = new Set(
      [...renderedNodeIds, ...desired].filter((id) => knownIds.has(id))
    )
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

  function recompute(): void {
    mountRecomputeScheduled = false
    pruneState()
    snapshot = createSnapshot()
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

  function updateRuntime(state: RenderingRuntimeState): void {
    const graphChanged = graph !== state.graph
    const nextNodes = state.nodes.map((node) => ({
      id: node.id,
      renderArea: freezeArea(node.renderArea)
    }))
    const nextRequired = Array.from(
      new Set(state.frontendRequiredNodeIds.map(String))
    )
    const stateChanged =
      graphChanged ||
      managerAvailable !== state.managerAvailable ||
      !areRenderingNodesEqual(nodes, nextNodes) ||
      !areAreasEqual(visibleCanvasArea, state.visibleCanvasArea) ||
      !areArraysEqual(frontendRequiredNodeIds, nextRequired) ||
      renderFrozen !== state.renderFrozen
    if (!stateChanged) return

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
    nodes = nextNodes
    visibleCanvasArea = state.visibleCanvasArea
      ? freezeArea(state.visibleCanvasArea)
      : null
    frontendRequiredNodeIds = nextRequired
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
    recompute()
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
        owner.contribution = normalizeContribution(contribution, knownNodeIds())
        recompute()
      },
      clear() {
        if (owners.get(ownerName) !== owner) return
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
