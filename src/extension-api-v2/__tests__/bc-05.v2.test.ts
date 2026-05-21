// Category: BC.05 — Custom DOM widgets and node sizing
// DB cross-ref: S4.W2, S2.N11
// Exemplar: https://github.com/Lightricks/ComfyUI-LTXVideo/blob/main/web/js/sparse_track_editor.js#L218
//
// AXIOM-EXCLUDED (wave-10, D-ban-runtime-addwidget, AXIOMS.md A15):
//   v2 NodeHandle.addDOMWidget / addWidget surfaces removed. All tests in
//   this file are wrapped with `axiomExcluded({...})` (vitest test.fails)
//   and continue to run as regression alarms — if the v2 surface is
//   ever re-introduced, these tests flip to FAIL.
//
//   Migration paths for original consumers:
//   - Declare in Python INPUT_TYPES
//   - Boxed widget (e.g. BBOX [x,y,w,h])
//   - Non-widget UI primitive via defineNode/defineExtension setup()
//
//   The "compat-floor blast_radius ≥ 2.0 MUST pass before v2 ships"
//   doctrine is retired (AXIOMS.md §Axiom-Excluded Test Annotation Policy).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { axiomExcluded } from './helpers/axiomExcluded'

const excluded = axiomExcluded({
  axiom: 'A15',
  adr: 'decisions/D-ban-runtime-addwidget.md',
  rationale:
    'Widgets are schema-declared per A15; v2 NodeHandle does not expose addDOMWidget/addWidget.',
  migration: [
    'Declare in Python INPUT_TYPES',
    'Boxed widget (e.g. BBOX [x,y,w,h])',
    'Non-widget UI primitive via defineNode/defineExtension setup()'
  ],
  restoration: 'D-ban-runtime-addwidget §Restoration criteria'
})

// ── Mock world (same pattern as bc-01.v2.test.ts) ────────────────────────────

// vi.hoisted factory runs before imports — keep handle creation inline.
const { mockGetComponent, mockEntitiesWith } = vi.hoisted(() => ({
  mockGetComponent: vi.fn(),
  mockEntitiesWith: vi.fn(() => [] as unknown[])
}))

import {
  componentKeyMockFactory,
  emptyMockFactory,
  widgetComponentsMockFactory,
  worldInstanceMockFactory
} from './harness/worldMocks'

// vi.mock factories are hoisted; keep imported helpers behind arrows so
// the import binding is read lazily at factory invocation time.
vi.mock('@/world/worldInstance', () =>
  worldInstanceMockFactory({ mockGetComponent, mockEntitiesWith })
)

vi.mock('@/world/widgets/widgetComponents', () => widgetComponentsMockFactory())

vi.mock('@/world/entityIds', () => emptyMockFactory())

vi.mock('@/world/componentKey', () => componentKeyMockFactory())

vi.mock('@/extension-api/node', () => emptyMockFactory())
vi.mock('@/extension-api/widget', () => emptyMockFactory())
vi.mock('@/extension-api/lifecycle', () => emptyMockFactory())

import {
  _clearExtensionsForTesting,
  _setDispatchImplForTesting,
  defineNode,
  mountExtensionsForNode,
  unmountExtensionsForNode
} from '@/services/extension-api-service'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'

// Stub for the removed `getDOMWidgetElement` export. The side table was
// deleted alongside the v2 addDOMWidget shim per D-ban-runtime-addwidget;
// tests that reference it remain (wrapped via axiomExcluded) so the
// resulting assertion failures continue to flag any re-introduction.
const getDOMWidgetElement = (
  _widgetId: WidgetEntityId
): HTMLElement | undefined => undefined

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNodeId(n: number): NodeEntityId {
  return `node:graph-uuid-bc05:${n}` as unknown as NodeEntityId
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
  Object.defineProperty(el, 'offsetHeight', {
    value: height,
    configurable: true
  })
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
    excluded('addDOMWidget dispatches a CreateWidget command with type "DOM" and the given name', () => {
      const el = makeDiv()

      defineNode({
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

    excluded('addDOMWidget returns a WidgetHandle with the correct name', () => {
      let handleName: string | undefined

      defineNode({
        name: 'bc05.v2.handle-name',
        nodeCreated(handle) {
          const wh = handle.addDOMWidget({
            name: 'preview',
            element: makeDiv()
          })
          handleName = wh.name
        }
      })

      const id = makeNodeId(2)
      stubNodeType(id)
      mountExtensionsForNode(id)

      expect(handleName).toBe('preview')
    })

    excluded('addDOMWidget stores the DOM element in a side table (not in command options, for serializability)', () => {
      const el = makeDiv()
      let widgetId: WidgetEntityId | undefined

      defineNode({
        name: 'bc05.v2.element-stored',
        nodeCreated(handle) {
          const wh = handle.addDOMWidget({ name: 'canvas', element: el })
          widgetId = wh.id as WidgetEntityId
        }
      })

      const id = makeNodeId(3)
      stubNodeType(id)
      mountExtensionsForNode(id)

      // Element is NOT in the command options (commands must be serializable)
      const createCmd = dispatchedCommands.find(
        (c) => c.type === 'CreateWidget' && c.name === 'canvas'
      ) as { options: Record<string, unknown> } | undefined

      expect(createCmd?.options.__domElement).toBeUndefined()

      // Element is stored in side table, retrievable via getDOMWidgetElement()
      expect(widgetId).toBeDefined()
      expect(getDOMWidgetElement(widgetId!)).toBe(el)
    })

    excluded('addDOMWidget uses the provided height option rather than offsetHeight when specified', () => {
      const el = makeDiv(120) // offsetHeight = 120
      const customHeight = 250

      defineNode({
        name: 'bc05.v2.custom-height',
        nodeCreated(handle) {
          handle.addDOMWidget({
            name: 'editor',
            element: el,
            height: customHeight
          })
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

    excluded('addDOMWidget falls back to element.offsetHeight when no height option is given', () => {
      const el = makeDiv(88)

      defineNode({
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

    excluded('DOM element is removed from the document when the node scope is disposed', () => {
      const el = makeDiv()
      document.body.appendChild(el)
      expect(document.body.contains(el)).toBe(true)

      defineNode({
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
    excluded('WidgetHandle.setHeight dispatches a SetWidgetOption command with key "__domHeight"', () => {
      defineNode({
        name: 'bc05.v2.set-height',
        nodeCreated(handle) {
          const wh = handle.addDOMWidget({
            name: 'resizable',
            element: makeDiv(100)
          })
          wh.setHeight(300)
        }
      })

      const id = makeNodeId(7)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const setCmd = dispatchedCommands.find(
        (c) =>
          c.type === 'SetWidgetOption' &&
          c.key === '__domHeight' &&
          c.value === 300
      )

      expect(setCmd).toBeDefined()
    })

    excluded('multiple addDOMWidget calls each produce independent CreateWidget commands', () => {
      defineNode({
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
