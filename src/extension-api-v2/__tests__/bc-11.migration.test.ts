// Category: BC.11 — Widget imperative state writes
// DB cross-ref: S4.W4, S4.W5, S2.N16
// Exemplar: https://github.com/r-vage/ComfyUI_Eclipse/blob/main/js/eclipse-set-get.js#L9
// Migration: v1 direct property mutation (widget.value, widget.options.values, node.widgets.push/splice)
//            → v2 WidgetHandle.setValue / setOption / NodeHandle.addWidget

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

// ── V1 widget shim ────────────────────────────────────────────────────────────
// Minimal replica of v1 widget direct-mutation pattern.

interface V1Widget {
  name: string
  value: unknown
  callback?: ((v: unknown) => void) | undefined
  options?: { values: unknown[] }
}

interface V1Node {
  widgets: V1Widget[]
}

function createV1Widget(name: string, value: unknown): V1Widget {
  return { name, value, callback: undefined }
}

function createV1ComboWidget(name: string, value: string, values: string[]): V1Widget {
  return { name, value, callback: undefined, options: { values } }
}

function createV1Node(widgets: V1Widget[] = []): V1Node {
  return { widgets }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNodeId(n: number): NodeEntityId {
  return `node:graph-uuid-bc11-mig:${n}` as NodeEntityId
}

function stubNodeType(id: NodeEntityId, comfyClass = 'TestNode') {
  mockGetComponent.mockImplementation((eid, key: { name: string }) => {
    if (eid !== id) return undefined
    if (key.name === 'NodeType') return { type: comfyClass, comfyClass }
    return undefined
  })
}

const ALL_TEST_IDS = Array.from({ length: 8 }, (_, i) => makeNodeId(i + 1))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.11 migration — widget imperative state writes', () => {
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

  describe('widget.value → WidgetHandle.setValue() (S4.W4)', () => {
    it('v1 direct assignment and v2 setValue() both record the new value', () => {
      // v1: direct property mutation
      const v1Widget = createV1Widget('steps', 20)
      v1Widget.value = 30
      const v1Result = v1Widget.value

      // v2: dispatch-based setValue
      let v2WidgetId: string | undefined
      defineNodeExtension({
        name: 'bc11.mig.set-value',
        nodeCreated(handle) {
          const wh = handle.addWidget('INT', 'steps', 20, {})
          v2WidgetId = wh.entityId as string
          wh.setValue(30)
        }
      })

      const id = makeNodeId(1)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const setCmd = dispatchedCommands.find(
        (c) => c.type === 'SetWidgetValue' && c.value === 30
      ) as { widgetId: string; value: unknown } | undefined

      // Both recorded value 30; v2 does so via command dispatch
      expect(v1Result).toBe(30)
      expect(setCmd).toBeDefined()
      expect(setCmd?.value).toBe(30)
      expect(setCmd?.widgetId).toBe(v2WidgetId)
    })

    it('v1 direct assignment does not produce a dispatchable record; v2 setValue() always produces one', () => {
      // v1: no command dispatch — just a property write
      const v1Widget = createV1Widget('cfg', 7.0)
      const v1CommandsBefore = dispatchedCommands.length
      v1Widget.value = 8.5
      const v1CommandsAfter = dispatchedCommands.length
      // v1 produces zero dispatch commands
      expect(v1CommandsAfter - v1CommandsBefore).toBe(0)

      // v2: always dispatches
      defineNodeExtension({
        name: 'bc11.mig.set-value-dispatch',
        nodeCreated(handle) {
          const wh = handle.addWidget('FLOAT', 'cfg', 7.0, {})
          wh.setValue(8.5)
        }
      })
      const id = makeNodeId(2)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const setCmd = dispatchedCommands.find((c) => c.type === 'SetWidgetValue')
      expect(setCmd).toBeDefined()
    })
  })

  describe('widget.options.values → WidgetHandle.setOption({ values }) (S4.W5)', () => {
    it('v1 options.values mutation and v2 setOption both replace the COMBO option list', () => {
      const newValues = ['euler', 'dpm_2', 'lcm']

      // v1: direct options mutation
      const v1Widget = createV1ComboWidget('sampler', 'euler', ['euler', 'dpm_2'])
      v1Widget.options!.values = newValues
      expect(v1Widget.options!.values).toEqual(newValues)

      // v2: setOption dispatch
      defineNodeExtension({
        name: 'bc11.mig.set-options',
        nodeCreated(handle) {
          const wh = handle.addWidget('COMBO', 'sampler', 'euler', { values: ['euler', 'dpm_2'] })
          wh.setOption('values', newValues)
        }
      })
      const id = makeNodeId(3)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const optCmd = dispatchedCommands.find(
        (c) => c.type === 'SetWidgetOption' && c.key === 'values'
      ) as { value: unknown } | undefined

      expect(optCmd).toBeDefined()
      expect(optCmd?.value).toEqual(newValues)
    })

    it('both v1 and v2 option-set operations are independent per widget', () => {
      // v1: two widgets, each with independent options mutation
      const v1WidgetA = createV1ComboWidget('schedulerA', 'karras', ['karras', 'normal'])
      const v1WidgetB = createV1ComboWidget('schedulerB', 'karras', ['karras', 'normal'])
      v1WidgetA.options!.values = ['karras', 'exponential']
      // B is unaffected
      expect(v1WidgetB.options!.values).toEqual(['karras', 'normal'])
      expect(v1WidgetA.options!.values).toEqual(['karras', 'exponential'])

      // v2: same independence via named widget identity
      defineNodeExtension({
        name: 'bc11.mig.option-independence',
        nodeCreated(handle) {
          const whA = handle.addWidget('COMBO', 'schedulerA', 'karras', { values: ['karras', 'normal'] })
          handle.addWidget('COMBO', 'schedulerB', 'karras', { values: ['karras', 'normal'] })
          whA.setOption('values', ['karras', 'exponential'])
        }
      })
      const id = makeNodeId(4)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const optCmds = dispatchedCommands.filter((c) => c.type === 'SetWidgetOption' && c.key === 'values')
      // Only one setOption dispatch — for whA
      expect(optCmds).toHaveLength(1)
    })
  })

  describe('node.widgets.push/splice → NodeHandle.addWidget (S2.N16)', () => {
    it('v1 push and v2 addWidget both result in a new widget with the expected name', () => {
      // v1: push into node.widgets
      const v1Node = createV1Node()
      const v1NewWidget = createV1Widget('dynamic_lora', '')
      v1Node.widgets.push(v1NewWidget)
      const v1Names = v1Node.widgets.map((w) => w.name)

      // v2: addWidget dispatch
      const v2Names: string[] = []
      defineNodeExtension({
        name: 'bc11.mig.add-widget',
        nodeCreated(handle) {
          const wh = handle.addWidget('STRING', 'dynamic_lora', '', {})
          v2Names.push(wh.name)
        }
      })
      const id = makeNodeId(5)
      stubNodeType(id)
      mountExtensionsForNode(id)

      expect(v1Names).toContain('dynamic_lora')
      expect(v2Names).toContain('dynamic_lora')
    })

    it('v1 splice by index is position-dependent; v2 addWidget uses name-keyed identity (no drift)', () => {
      // v1: positional splice — inserting before 'cfg' bumps 'cfg' index
      const v1Node = createV1Node([
        createV1Widget('steps', 20),
        createV1Widget('cfg', 7.0)
      ])
      // Insert at index 1 — cfg shifts to index 2
      v1Node.widgets.splice(1, 0, createV1Widget('new_widget', 0))
      expect(v1Node.widgets[2].name).toBe('cfg') // positional drift
      expect(v1Node.widgets[1].name).toBe('new_widget')

      // v2: addWidget uses name key — 'cfg' remains at key 'cfg' regardless of insertion order
      const createCmds: Record<string, unknown>[] = []
      defineNodeExtension({
        name: 'bc11.mig.no-drift',
        nodeCreated(handle) {
          handle.addWidget('INT', 'steps', 20, {})
          handle.addWidget('INT', 'new_widget', 0, {})
          handle.addWidget('FLOAT', 'cfg', 7.0, {})
        }
      })
      const id = makeNodeId(6)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const names = dispatchedCommands
        .filter((c) => c.type === 'CreateWidget')
        .map((c) => c.name)

      // All three present; order is insertion order but names are stable
      expect(names).toContain('cfg')
      expect(names).toContain('steps')
      expect(names).toContain('new_widget')
    })

    it('v2 addWidget returns a WidgetHandle that can immediately call setValue — no index lookup needed', () => {
      defineNodeExtension({
        name: 'bc11.mig.immediate-set',
        nodeCreated(handle) {
          const wh = handle.addWidget('INT', 'strength', 0, {})
          wh.setValue(100)
        }
      })
      const id = makeNodeId(7)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const setCmd = dispatchedCommands.find(
        (c) => c.type === 'SetWidgetValue' && c.value === 100
      )
      expect(setCmd).toBeDefined()
    })

    it('v1 push requires manual index tracking; v2 addWidget returns handle directly — no index bookkeeping', () => {
      // v1: to get the widget back after push, you track the index
      const v1Node = createV1Node()
      v1Node.widgets.push(createV1Widget('added', ''))
      const v1ByIndex = v1Node.widgets[0] // must track index manually
      expect(v1ByIndex.name).toBe('added')

      // v2: handle returned from addWidget — no index
      let whName: string | undefined
      defineNodeExtension({
        name: 'bc11.mig.handle-returned',
        nodeCreated(handle) {
          const wh = handle.addWidget('STRING', 'added', '', {})
          whName = wh.name // no index needed
        }
      })
      const id = makeNodeId(8)
      stubNodeType(id)
      mountExtensionsForNode(id)

      expect(whName).toBe('added')
    })
  })

  describe('Phase B deferred', () => {
    it.todo(
      'v1 direct widget.value assignment and v2 setValue() both result in the same displayed value on the canvas after flush (Phase B — requires LiteGraph canvas)'
    )
    it.todo(
      'v2 setOption({ values }) that removes current value causes on("valueChange") with newValue = options[0]; v1 does not auto-fire change (Phase B)'
    )
    it.todo(
      'v1 node.widgets.push requires manual setSize reflow; v2 addWidget performs it automatically — no double-reflow when migrating (Phase B)'
    )
  })
})
