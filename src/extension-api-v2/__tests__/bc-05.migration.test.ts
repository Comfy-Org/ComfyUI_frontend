// Category: BC.05 — Custom DOM widgets and node sizing
// DB cross-ref: S4.W2, S2.N11
// Exemplar: https://github.com/Lightricks/ComfyUI-LTXVideo/blob/main/web/js/sparse_track_editor.js#L218
// compat-floor: blast_radius 5.45 ≥ 2.0 — MUST pass before v2 ships
// Migration: v1 node.addDOMWidget + node.computeSize → v2 NodeHandle.addDOMWidget + WidgetHandle.setHeight

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock world (same pattern as bc-01.migration.test.ts) ──────────────────────

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

vi.mock('@/world/widgets/widgetComponents', () => ({
  WidgetComponentContainer: Symbol('WidgetComponentContainer'),
  WidgetComponentDisplay: Symbol('WidgetComponentDisplay'),
  WidgetComponentSchema: Symbol('WidgetComponentSchema'),
  WidgetComponentSerialize: Symbol('WidgetComponentSerialize'),
  WidgetComponentValue: Symbol('WidgetComponentValue')
}))

vi.mock('@/world/entityIds', () => ({}))

vi.mock('@/world/componentKey', () => ({
  defineComponentKey: (name: string) => ({ name })
}))

vi.mock('@/extension-api/node', () => ({}))
vi.mock('@/extension-api/widget', () => ({}))
vi.mock('@/extension-api/lifecycle', () => ({}))

import {
  _clearExtensionsForTesting,
  _setDispatchImplForTesting,
  defineNodeExtension,
  mountExtensionsForNode,
  unmountExtensionsForNode
} from '@/services/extension-api-service'
import type { NodeEntityId } from '@/world/entityIds'

// ── V1 shim ───────────────────────────────────────────────────────────────────
// Minimal in-memory replica of v1 node.addDOMWidget + node.computeSize behavior.

interface V1DOMWidgetRecord {
  name: string
  type: string
  element: HTMLElement
  height: number
}

interface V1Node {
  id: number
  type: string
  domWidgets: V1DOMWidgetRecord[]
  computeSizeOverridden: boolean
  computedSize: [number, number]
  addDOMWidget(
    name: string,
    type: string,
    element: HTMLElement,
    opts?: { getHeight?: () => number }
  ): V1DOMWidgetRecord
  _overrideComputeSize(fn: (out: [number, number]) => [number, number]): void
}

function createV1Node(id: number, type = 'TestNode'): V1Node {
  const domWidgets: V1DOMWidgetRecord[] = []

  return {
    id,
    type,
    domWidgets,
    computeSizeOverridden: false,
    computedSize: [200, 100] as [number, number],
    addDOMWidget(name, wtype, element, opts) {
      const height = opts?.getHeight?.() ?? element.offsetHeight
      const record: V1DOMWidgetRecord = { name, type: wtype, element, height }
      domWidgets.push(record)
      this.computedSize[1] += height
      return record
    },
    _overrideComputeSize(fn) {
      this.computeSizeOverridden = true
      this.computedSize = fn(this.computedSize)
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNodeId(n: number): NodeEntityId {
  return `node:graph-uuid-bc05-mig:${n}` as NodeEntityId
}

function stubNodeType(id: NodeEntityId, comfyClass = 'TestNode') {
  mockGetComponent.mockImplementation((eid, key: { name: string }) => {
    if (eid !== id) return undefined
    if (key.name === 'NodeType') return { type: comfyClass, comfyClass }
    return undefined
  })
}

function makeDiv(height = 120): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true })
  return el
}

const ALL_TEST_IDS = Array.from({ length: 12 }, (_, i) => makeNodeId(i + 1))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.05 migration — custom DOM widgets and node sizing', () => {
  let dispatchedCommands: Record<string, unknown>[]

  beforeEach(() => {
    vi.clearAllMocks()
    dispatchedCommands = []
    _clearExtensionsForTesting()
    ALL_TEST_IDS.forEach((id) => unmountExtensionsForNode(id))

    _setDispatchImplForTesting((cmd) => {
      dispatchedCommands.push(cmd)
      if (cmd.type === 'CreateWidget') {
        return `widget:graph:${String(cmd.parentNodeId)}:${String(cmd.name)}`
      }
      return undefined
    })
  })

  afterEach(() => {
    _setDispatchImplForTesting(null)
  })

  describe('widget registration parity (S4.W2)', () => {
    it('v1 addDOMWidget and v2 addDOMWidget both register a widget with the given name', () => {
      const el = makeDiv()

      // v1 pattern
      const v1Node = createV1Node(1)
      v1Node.addDOMWidget('editor', 'custom', el)
      const v1Names = v1Node.domWidgets.map((w) => w.name)

      // v2 pattern
      const registeredNames: string[] = []
      defineNodeExtension({
        name: 'bc05.mig.register-parity',
        nodeCreated(handle) {
          const wh = handle.addDOMWidget({ name: 'editor', element: el })
          registeredNames.push(wh.name)
        }
      })
      const id = makeNodeId(1)
      stubNodeType(id)
      mountExtensionsForNode(id)

      expect(registeredNames).toEqual(v1Names)
    })

    it('v1 opts.getHeight() value matches the v2 height option stored in the dispatch command', () => {
      const el = makeDiv(0) // offsetHeight irrelevant
      const reportedHeight = 200

      // v1: getHeight callback
      const v1Node = createV1Node(2)
      v1Node.addDOMWidget('widget', 'custom', el, { getHeight: () => reportedHeight })
      const v1Height = v1Node.domWidgets[0].height

      // v2: explicit height option
      defineNodeExtension({
        name: 'bc05.mig.height-parity',
        nodeCreated(handle) {
          handle.addDOMWidget({ name: 'widget', element: el, height: reportedHeight })
        }
      })
      const id = makeNodeId(2)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const createCmd = dispatchedCommands.find(
        (c) => c.type === 'CreateWidget' && c.name === 'widget'
      ) as { options: { __domHeight: number } } | undefined

      expect(createCmd?.options.__domHeight).toBe(v1Height)
    })

    it('v2 registers the same number of DOM widgets as v1 for a multi-widget node', () => {
      // v1 pattern: two addDOMWidget calls
      const v1Node = createV1Node(3)
      v1Node.addDOMWidget('widgetA', 'custom', makeDiv(50))
      v1Node.addDOMWidget('widgetB', 'custom', makeDiv(80))
      const v1Count = v1Node.domWidgets.length

      // v2 pattern
      defineNodeExtension({
        name: 'bc05.mig.multi-count',
        nodeCreated(handle) {
          handle.addDOMWidget({ name: 'widgetA', element: makeDiv(50) })
          handle.addDOMWidget({ name: 'widgetB', element: makeDiv(80) })
        }
      })
      const id = makeNodeId(3)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const v2DomWidgets = dispatchedCommands.filter(
        (c) => c.type === 'CreateWidget' && c.widgetType === 'DOM'
      )

      expect(v2DomWidgets).toHaveLength(v1Count)
    })
  })

  describe('computeSize elimination (S2.N11)', () => {
    it('v2 setHeight produces a SetWidgetOption command; v1 requires a computeSize override for the same effect', () => {
      const el = makeDiv(100)
      const newHeight = 400

      // v1: manual computeSize override is required
      const v1Node = createV1Node(4)
      v1Node.addDOMWidget('widget', 'custom', el)
      v1Node._overrideComputeSize((out) => [out[0], newHeight])
      expect(v1Node.computeSizeOverridden).toBe(true)

      // v2: no computeSize — just setHeight on the WidgetHandle
      defineNodeExtension({
        name: 'bc05.mig.no-compute-size',
        nodeCreated(handle) {
          const wh = handle.addDOMWidget({ name: 'widget', element: el })
          wh.setHeight(newHeight)
        }
      })
      const id = makeNodeId(4)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const heightCmd = dispatchedCommands.find(
        (c) => c.type === 'SetWidgetOption' && c.key === '__domHeight' && c.value === newHeight
      )

      // v1 needed a computeSize override; v2 achieves the same via SetWidgetOption dispatch
      expect(heightCmd).toBeDefined()
    })
  })

  describe('cleanup parity', () => {
    it('v1 requires manual removal in onRemoved; v2 auto-removes the element via scope disposal', () => {
      const el = makeDiv()
      document.body.appendChild(el)

      // v1 pattern: manual teardown via onRemoved
      let v1CleanedUp = false
      const v1OnRemoved = () => {
        el.remove()
        v1CleanedUp = true
      }
      v1OnRemoved()
      expect(v1CleanedUp).toBe(true)

      // Re-attach for v2 test
      document.body.appendChild(el)
      expect(document.body.contains(el)).toBe(true)

      // v2 pattern: auto-cleanup on scope dispose (via onScopeDispose in addDOMWidget)
      defineNodeExtension({
        name: 'bc05.mig.auto-cleanup',
        nodeCreated(handle) {
          handle.addDOMWidget({ name: 'widget', element: el })
        }
      })
      const id = makeNodeId(5)
      stubNodeType(id)
      mountExtensionsForNode(id)
      unmountExtensionsForNode(id)

      // Both v1 (manual) and v2 (auto) result in element absent after node removal
      expect(document.body.contains(el)).toBe(false)
    })

    it('v2 auto-cleanup only removes the element registered via addDOMWidget, not unrelated elements', () => {
      const registeredEl = makeDiv()
      const unrelatedEl = makeDiv()
      document.body.appendChild(registeredEl)
      document.body.appendChild(unrelatedEl)

      defineNodeExtension({
        name: 'bc05.mig.scoped-cleanup',
        nodeCreated(handle) {
          handle.addDOMWidget({ name: 'registered', element: registeredEl })
          // unrelatedEl is NOT registered — must survive scope disposal
        }
      })
      const id = makeNodeId(6)
      stubNodeType(id)
      mountExtensionsForNode(id)
      unmountExtensionsForNode(id)

      expect(document.body.contains(registeredEl)).toBe(false)
      expect(document.body.contains(unrelatedEl)).toBe(true)

      unrelatedEl.remove()
    })
  })

  describe('Phase B deferred', () => {
    it.todo(
      // Phase B: requires real LiteGraph canvas + ECS DOM widget component.
      'v1 computeSize override and v2 auto-computeSize produce identical node dimensions at render time (Phase B)'
    )
    it.todo(
      // Phase B: requires WidgetComponentContainer wired.
      'v1 node.widgets array and v2 NodeHandle.widgets() both include the DOM widget by name (Phase B)'
    )
  })
})
