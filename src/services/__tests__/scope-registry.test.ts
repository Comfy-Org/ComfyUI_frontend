// D12 regression: copy/paste must yield reset-to-fresh extensionState, not clone.
// Decision: decisions/D12-scope-clone-on-copy.md — Option (c) accepted.
// Task: I-SR.2.B5

import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock world ────────────────────────────────────────────────────────────────
// The world must be mocked before the service is imported so the import-time
// getWorld() call picks up the mock. We fake only what the service exercises:
// getComponent() with NodeTypeKey (gates mountExtensionsForNode early-return)
// and entitiesWith() (used by startExtensionSystem's watch — not exercised here).

const mockGetComponent = vi.fn()
const mockEntitiesWith = vi.fn(() => [])

vi.mock('@/world/worldInstance', () => ({
  getWorld: () => ({
    getComponent: mockGetComponent,
    entitiesWith: mockEntitiesWith,
    setComponent: vi.fn(),
    removeComponent: vi.fn()
  })
}))

// Widget/node component modules must exist as mock modules so the service's
// top-level imports don't fail. The actual values are opaque keys; we just need
// them to be non-null references so `getComponent(id, key)` calls resolve.
vi.mock('@/world/widgets/widgetComponents', () => ({
  WidgetComponentContainer: Symbol('WidgetComponentContainer'),
  WidgetComponentDisplay: Symbol('WidgetComponentDisplay'),
  WidgetComponentSchema: Symbol('WidgetComponentSchema'),
  WidgetComponentSerialize: Symbol('WidgetComponentSerialize'),
  WidgetComponentValue: Symbol('WidgetComponentValue')
}))

vi.mock('@/world/entityIds', () => ({}))

// defineComponentKey returns an identity object; tests don't need real ECS queries.
vi.mock('@/world/componentKey', () => ({
  defineComponentKey: (name: string) => ({ name })
}))

// extension-api types: service re-exports from these, mocking prevents import errors.
vi.mock('@/extension-api/node', () => ({}))
vi.mock('@/extension-api/widget', () => ({}))
vi.mock('@/extension-api/lifecycle', () => ({}))

// ── Import service (after mocks are in place) ────────────────────────────────
import {
  _clearExtensionsForTesting,
  defineNode,
  getCurrentScope,
  getScopeRegistry,
  mountExtensionsForNode,
  onNodeMounted,
  onNodeRemoved,
  unmountExtensionsForNode
} from '../extension-api-service'
import type { NodeEntityId } from '@/world/entityIds'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeNodeId(n: number): NodeEntityId {
  return `node:graph-uuid-test:${n}` as NodeEntityId
}

function stubNodeType(nodeEntityId: NodeEntityId, comfyClass = 'TestNode') {
  mockGetComponent.mockImplementation((id, key) => {
    if (id === nodeEntityId && key?.name === 'NodeType')
      return { type: comfyClass, comfyClass }
    return undefined
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('scope-registry — D12 copy/paste reset semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearExtensionsForTesting()
    ;[1, 2, 3, 4, 100, 101, 102, 103].forEach((n) => {
      unmountExtensionsForNode(makeNodeId(n))
    })
  })

  describe('D12(c): clone gets fresh extensionState, not source value', () => {
    it('copy-pasted node (new entityId) starts with setup-default extensionState, not mutated source state', () => {
      const SOURCE_ID = makeNodeId(1)
      const CLONE_ID = makeNodeId(2)

      // Register an extension that initialises count = 0 every time setup runs.
      // The extension stores a ref so we can mutate it after mount.
      const counters = new Map<NodeEntityId, ReturnType<typeof ref>>()

      defineNode({
        name: 'z-counter',
        nodeCreated(handle) {
          const count = ref(0)
          counters.set(handle.entityId as NodeEntityId, count)
          return { count }
        }
      })

      // Mount source node.
      stubNodeType(SOURCE_ID)
      mountExtensionsForNode(SOURCE_ID)

      // Mutate source extensionState (simulates user interaction driving count up).
      const sourceCounter = counters.get(SOURCE_ID)!
      expect(sourceCounter.value).toBe(0)
      sourceCounter.value = 42

      // Verify the mutation is visible via getScopeRegistry().
      // proxyRefs unwraps refs, so extensionState.count returns the number directly (D10d).
      const sourceEntry = getScopeRegistry().get(`z-counter:${SOURCE_ID}`)!
      expect((sourceEntry.extensionState as { count: number }).count).toBe(42)

      // Simulate copy/paste: new entityId added to the world.
      // D12(c): mountExtensionsForNode runs fresh setup — no priorState.
      stubNodeType(CLONE_ID)
      mountExtensionsForNode(CLONE_ID)

      // Clone's extensionState must be the setup-default (0), not source's (42).
      const cloneEntry = getScopeRegistry().get(`z-counter:${CLONE_ID}`)!
      expect(cloneEntry).toBeDefined()
      expect((cloneEntry.extensionState as { count: number }).count).toBe(0)

      // Source is unaffected.
      const sourceAfter = getScopeRegistry().get(`z-counter:${SOURCE_ID}`)!
      expect((sourceAfter.extensionState as { count: number }).count).toBe(42)
    })

    it('N pastes from the same source all start at setup-default (no shared state)', () => {
      const SOURCE_ID = makeNodeId(100)
      const PASTE_IDS = [
        makeNodeId(101),
        makeNodeId(102),
        makeNodeId(103)
      ] as NodeEntityId[]

      let setupCallCount = 0

      defineNode({
        name: 'a-setup-counter',
        nodeCreated() {
          setupCallCount++
          return { iteration: ref(setupCallCount) }
        }
      })

      stubNodeType(SOURCE_ID)
      mountExtensionsForNode(SOURCE_ID)
      const countAfterSource = setupCallCount // 1

      for (const pasteId of PASTE_IDS) {
        stubNodeType(pasteId)
        mountExtensionsForNode(pasteId)
      }

      // Each paste ran setup() independently.
      expect(setupCallCount).toBe(countAfterSource + PASTE_IDS.length)

      // Each paste scope holds its own `iteration` value — no aliasing.
      // proxyRefs unwraps refs so we access .iteration directly (D10d).
      const iterations = PASTE_IDS.map((id) => {
        const entry = getScopeRegistry().get(`a-setup-counter:${id}`)!
        return (entry.extensionState as { iteration: number }).iteration
      })
      const unique = new Set(iterations)
      expect(unique.size).toBe(PASTE_IDS.length)
    })

    it('unmounting source does not affect clone scope', () => {
      const SOURCE_ID = makeNodeId(3)
      const CLONE_ID = makeNodeId(4)

      defineNode({
        name: 'b-flag',
        nodeCreated() {
          return { flag: ref(true) }
        }
      })

      stubNodeType(SOURCE_ID)
      mountExtensionsForNode(SOURCE_ID)
      stubNodeType(CLONE_ID)
      mountExtensionsForNode(CLONE_ID)

      unmountExtensionsForNode(SOURCE_ID)

      // Source scope removed from registry.
      expect(getScopeRegistry().get(`b-flag:${SOURCE_ID}`)).toBeUndefined()

      // Clone scope survives independently.
      const cloneEntry = getScopeRegistry().get(`b-flag:${CLONE_ID}`)
      expect(cloneEntry).toBeDefined()
      // proxyRefs unwraps refs so .flag returns the boolean directly (D10d).
      expect((cloneEntry!.extensionState as { flag: boolean }).flag).toBe(true)
    })
  })
})

// ── I-SR.2.B3 + I-SR.3: currentExtension slot + lifecycle hooks ───────────────
// Tests that _currentScope is set/restored around setup() and that
// onNodeMounted/onNodeRemoved read it correctly (D10a).

describe('currentExtension global slot (D10a) + lifecycle hooks (I-SR.2.B3 / I-SR.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearExtensionsForTesting()
    ;[10, 11, 12].forEach((n) => unmountExtensionsForNode(makeNodeId(n)))
  })

  it('getCurrentScope() returns null outside of setup', () => {
    expect(getCurrentScope()).toBeNull()
  })

  it('getCurrentScope() is non-null during nodeCreated setup', () => {
    const NODE_ID = makeNodeId(10)
    let scopeDuringSetup: ReturnType<typeof getCurrentScope> = null

    defineNode({
      name: 'c-slot-check',
      nodeCreated() {
        scopeDuringSetup = getCurrentScope()
      }
    })

    stubNodeType(NODE_ID)
    mountExtensionsForNode(NODE_ID)

    expect(scopeDuringSetup).not.toBeNull()
    expect(scopeDuringSetup!.extensionName).toBe('c-slot-check')
    expect(scopeDuringSetup!.nodeEntityId).toBe(NODE_ID)
  })

  it('getCurrentScope() is restored to null after setup completes', () => {
    const NODE_ID = makeNodeId(11)

    defineNode({
      name: 'd-slot-restore',
      nodeCreated() {
        /* no-op */
      }
    })

    stubNodeType(NODE_ID)
    mountExtensionsForNode(NODE_ID)

    expect(getCurrentScope()).toBeNull()
  })

  it('onNodeRemoved callback fires when node is unmounted', () => {
    const NODE_ID = makeNodeId(12)
    const removedCb = vi.fn()

    defineNode({
      name: 'e-on-removed',
      nodeCreated() {
        onNodeRemoved(removedCb)
      }
    })

    stubNodeType(NODE_ID)
    mountExtensionsForNode(NODE_ID)
    expect(removedCb).not.toHaveBeenCalled()

    unmountExtensionsForNode(NODE_ID)
    expect(removedCb).toHaveBeenCalledOnce()
  })

  it('onNodeRemoved outside setup context throws in dev', () => {
    expect(() => onNodeRemoved(() => {})).toThrow(/outside setup context/)
  })

  it('onNodeMounted outside setup context throws in dev', () => {
    expect(() => onNodeMounted(() => {})).toThrow(/outside setup context/)
  })
})

// ── I-SR.6: missing lifecycle invariants ────────────────────────────────────────
// (a) setup-runs-once: calling mountExtensionsForNode twice on the same entity
//     must not re-run setup. The scope registry already has an entry — getOrCreateScope
//     short-circuits and setup is skipped.
// (b) no-dispose-on-subgraph-promotion: scopes survive DOM moves (subgraph promote).
//     The v2 contract is: scope lifetime = entity lifetime, NOT DOM lifetime.
//     Subgraph promotion creates a new logical location for the same entityId, but
//     the scope must survive — only unmountExtensionsForNode destroys it.

describe('I-SR.6 — scope lifecycle invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearExtensionsForTesting()
    ;[30, 31, 32].forEach((n) => unmountExtensionsForNode(makeNodeId(n)))
  })

  it('(setup-runs-once) mounting the same node twice does not re-invoke nodeCreated', () => {
    const NODE_ID = makeNodeId(30)
    let setupCount = 0

    defineNode({
      name: 'h-once',
      nodeCreated() {
        setupCount++
      }
    })

    mockGetComponent.mockImplementation((id, key) => {
      if (id === NODE_ID && key?.name === 'NodeType')
        return { type: 'TestNode', comfyClass: 'TestNode' }
      return undefined
    })

    mountExtensionsForNode(NODE_ID)
    // Second call on same entity — must be idempotent
    mountExtensionsForNode(NODE_ID)

    // setup ran exactly once (getOrCreateScope short-circuits on second call)
    expect(setupCount).toBe(1)
  })

  it('(no-dispose-on-subgraph-promotion) scope survives a non-removal remount; only unmount destroys it', () => {
    const NODE_ID = makeNodeId(31)
    let setupCount = 0

    defineNode({
      name: 'i-promotion',
      nodeCreated() {
        setupCount++
        // (In real Phase B, onNodeRemoved would be used; here we verify via
        //  setupCount that setup does not re-run, meaning scope was preserved.)
      }
    })

    mockGetComponent.mockImplementation((id, key) => {
      if (id === NODE_ID && key?.name === 'NodeType')
        return { type: 'TestNode', comfyClass: 'TestNode' }
      return undefined
    })

    mountExtensionsForNode(NODE_ID)
    expect(setupCount).toBe(1)

    // Simulate subgraph promotion: the runtime calls mountExtensionsForNode again
    // for the same entity (the node "moved" but the entityId is unchanged).
    mountExtensionsForNode(NODE_ID)

    // Scope was NOT disposed — setup did not re-run
    expect(setupCount).toBe(1)

    // Only an explicit unmount destroys the scope
    unmountExtensionsForNode(NODE_ID)

    // Scope removed from registry
    const entry = getScopeRegistry().get(`i-promotion:${NODE_ID}`)
    expect(entry).toBeUndefined()
  })
})

// ── I-SR.3.B4: reactive dispatch — LoadedFromWorkflow tag ─────────────────────
// Tests that LoadedFromWorkflow presence routes to loadedGraphNode hook
// (hydration) rather than nodeCreated (fresh creation).

describe('LoadedFromWorkflow tag routes to correct hook (I-SR.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearExtensionsForTesting()
    ;[20, 21].forEach((n) => unmountExtensionsForNode(makeNodeId(n)))
  })

  it('node without LoadedFromWorkflow tag calls nodeCreated', () => {
    const NODE_ID = makeNodeId(20)
    const created = vi.fn()
    const loaded = vi.fn()

    defineNode({
      name: 'f-routing',
      nodeCreated: created,
      loadedGraphNode: loaded
    })

    // Stub: no LoadedFromWorkflow component (getComponent returns undefined for it)
    mockGetComponent.mockImplementation((id, key) => {
      if (id === NODE_ID && key?.name === 'NodeType')
        return { type: 'TestNode', comfyClass: 'TestNode' }
      return undefined // no LoadedFromWorkflow
    })

    mountExtensionsForNode(NODE_ID)

    expect(created).toHaveBeenCalledOnce()
    expect(loaded).not.toHaveBeenCalled()
  })

  it('node with LoadedFromWorkflow tag calls loadedGraphNode', () => {
    const NODE_ID = makeNodeId(21)
    const created = vi.fn()
    const loaded = vi.fn()

    defineNode({
      name: 'g-routing',
      nodeCreated: created,
      loadedGraphNode: loaded
    })

    mockGetComponent.mockImplementation((id, key) => {
      if (id === NODE_ID && key?.name === 'NodeType')
        return { type: 'TestNode', comfyClass: 'TestNode' }
      if (id === NODE_ID && key?.name === 'LoadedFromWorkflow')
        return { _tag: 'LoadedFromWorkflow' }
      return undefined
    })

    mountExtensionsForNode(NODE_ID)

    expect(loaded).toHaveBeenCalledOnce()
    expect(created).not.toHaveBeenCalled()
  })
})
