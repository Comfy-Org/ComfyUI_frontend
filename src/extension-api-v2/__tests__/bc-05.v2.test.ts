// Category: BC.05 — Custom DOM widgets and node sizing
// DB cross-ref: S4.W2, S2.N11
// Exemplar: https://github.com/Lightricks/ComfyUI-LTXVideo/blob/main/web/js/sparse_track_editor.js#L218
// compat-floor: blast_radius 5.45 ≥ 2.0 — MUST pass before v2 ships
// v2 replacement: NodeHandle.addDOMWidget(opts) — auto-hooks computeSize via WidgetHandle geometry

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock world (same pattern as bc-01.v2.test.ts) ────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNodeId(n: number): NodeEntityId {
  return `node:graph-uuid-bc05:${n}` as NodeEntityId
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

const ALL_TEST_IDS = Array.from({ length: 10 }, (_, i) => makeNodeId(i + 1))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.05 v2 contract — custom DOM widgets and node sizing', () => {
  let dispatchedCommands: Record<string, unknown>[]

  beforeEach(() => {
    vi.clearAllMocks()
    dispatchedCommands = []
    _clearExtensionsForTesting()
    ALL_TEST_IDS.forEach((id) => unmountExtensionsForNode(id))

    _setDispatchImplForTesting((cmd) => {
      dispatchedCommands.push(cmd)
      // Return a synthetic widget entity ID for CreateWidget commands
      if (cmd.type === 'CreateWidget') {
        return `widget:graph:${String(cmd.parentNodeId)}:${String(cmd.name)}`
      }
      return undefined
    })
  })

  afterEach(() => {
    _setDispatchImplForTesting(null)
  })

  describe('NodeHandle.addDOMWidget(opts) — widget registration (S4.W2)', () => {
    it('addDOMWidget dispatches a CreateWidget command with type "DOM" and the given name', () => {
      const el = makeDiv()

      defineNodeExtension({
        name: 'bc05.v2.register',
        nodeCreated(handle) {
          handle.addDOMWidget({ name: 'myEditor', element: el })
        }
      })

      const id = makeNodeId(1)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const createCmd = dispatchedCommands.find(
        (c) => c.type === 'CreateWidget' && c.name === 'myEditor'
      ) as { widgetType: string } | undefined

      expect(createCmd).toBeDefined()
      expect(createCmd?.widgetType).toBe('DOM')
    })

    it('addDOMWidget returns a WidgetHandle with the correct name', () => {
      let handleName: string | undefined

      defineNodeExtension({
        name: 'bc05.v2.handle-name',
        nodeCreated(handle) {
          const wh = handle.addDOMWidget({ name: 'preview', element: makeDiv() })
          handleName = wh.name
        }
      })

      const id = makeNodeId(2)
      stubNodeType(id)
      mountExtensionsForNode(id)

      expect(handleName).toBe('preview')
    })

    it('addDOMWidget stores the DOM element reference in the options bag', () => {
      const el = makeDiv()

      defineNodeExtension({
        name: 'bc05.v2.element-stored',
        nodeCreated(handle) {
          handle.addDOMWidget({ name: 'canvas', element: el })
        }
      })

      const id = makeNodeId(3)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const createCmd = dispatchedCommands.find(
        (c) => c.type === 'CreateWidget' && c.name === 'canvas'
      ) as { options: { __domElement: HTMLElement } } | undefined

      expect(createCmd?.options.__domElement).toBe(el)
    })

    it('addDOMWidget uses the provided height option rather than offsetHeight when specified', () => {
      const el = makeDiv(120) // offsetHeight = 120
      const customHeight = 250

      defineNodeExtension({
        name: 'bc05.v2.custom-height',
        nodeCreated(handle) {
          handle.addDOMWidget({ name: 'editor', element: el, height: customHeight })
        }
      })

      const id = makeNodeId(4)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const createCmd = dispatchedCommands.find(
        (c) => c.type === 'CreateWidget' && c.name === 'editor'
      ) as { options: { __domHeight: number } } | undefined

      expect(createCmd?.options.__domHeight).toBe(customHeight)
    })

    it('addDOMWidget falls back to element.offsetHeight when no height option is given', () => {
      const el = makeDiv(88)

      defineNodeExtension({
        name: 'bc05.v2.fallback-height',
        nodeCreated(handle) {
          handle.addDOMWidget({ name: 'preview', element: el })
        }
      })

      const id = makeNodeId(5)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const createCmd = dispatchedCommands.find(
        (c) => c.type === 'CreateWidget' && c.name === 'preview'
      ) as { options: { __domHeight: number } } | undefined

      expect(createCmd?.options.__domHeight).toBe(88)
    })

    it('DOM element is removed from the document when the node scope is disposed', () => {
      const el = makeDiv()
      document.body.appendChild(el)
      expect(document.body.contains(el)).toBe(true)

      defineNodeExtension({
        name: 'bc05.v2.auto-cleanup',
        nodeCreated(handle) {
          handle.addDOMWidget({ name: 'widget', element: el })
        }
      })

      const id = makeNodeId(6)
      stubNodeType(id)
      mountExtensionsForNode(id)

      // Unmounting the node scope triggers onScopeDispose → el.remove()
      unmountExtensionsForNode(id)

      expect(document.body.contains(el)).toBe(false)
    })
  })

  describe('WidgetHandle geometry — setHeight (replaces S2.N11 computeSize override)', () => {
    it('WidgetHandle.setHeight dispatches a SetWidgetOption command with key "__domHeight"', () => {
      defineNodeExtension({
        name: 'bc05.v2.set-height',
        nodeCreated(handle) {
          const wh = handle.addDOMWidget({ name: 'resizable', element: makeDiv(100) })
          wh.setHeight(300)
        }
      })

      const id = makeNodeId(7)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const setCmd = dispatchedCommands.find(
        (c) => c.type === 'SetWidgetOption' && c.key === '__domHeight' && c.value === 300
      )

      expect(setCmd).toBeDefined()
    })

    it('multiple addDOMWidget calls each produce independent CreateWidget commands', () => {
      defineNodeExtension({
        name: 'bc05.v2.multi-widget',
        nodeCreated(handle) {
          handle.addDOMWidget({ name: 'widgetA', element: makeDiv(50) })
          handle.addDOMWidget({ name: 'widgetB', element: makeDiv(80) })
        }
      })

      const id = makeNodeId(8)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const createCmds = dispatchedCommands.filter(
        (c) => c.type === 'CreateWidget' && c.widgetType === 'DOM'
      )

      expect(createCmds).toHaveLength(2)
      const names = createCmds.map((c) => c.name)
      expect(names).toContain('widgetA')
      expect(names).toContain('widgetB')
    })
  })

  describe('Phase B deferred', () => {
    it.todo(
      // Phase B: requires LiteGraph canvas integration.
      // Auto-computeSize integration needs the actual LiteGraph node to reflect WidgetHandle.setHeight — deferred to Phase B.
      'WidgetHandle.setHeight() triggers a node relayout — the node height reflects the new widget reservation (Phase B)'
    )
    it.todo(
      // Phase B: requires real ECS DOM widget component.
      'addDOMWidget widget is accessible via NodeHandle.widgets() by name (Phase B — needs WidgetComponentContainer wired)'
    )
  })
})
