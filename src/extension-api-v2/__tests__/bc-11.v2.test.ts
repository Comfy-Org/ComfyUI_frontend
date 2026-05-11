// Category: BC.11 — Widget imperative state writes
// DB cross-ref: S4.W4, S4.W5, S2.N16
// Exemplar: https://github.com/r-vage/ComfyUI_Eclipse/blob/main/js/eclipse-set-get.js#L9
// blast_radius: 5.81 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v2 replacement: WidgetHandle.setValue(v), WidgetHandle.setOption(key,v), NodeHandle.addWidget(opts)

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
  return `node:graph-uuid-bc11:${n}` as NodeEntityId
}

function stubNodeType(id: NodeEntityId, comfyClass = 'TestNode') {
  mockGetComponent.mockImplementation((eid, key: { name: string }) => {
    if (eid !== id) return undefined
    if (key.name === 'NodeType') return { type: comfyClass, comfyClass }
    return undefined
  })
}

const ALL_TEST_IDS = Array.from({ length: 10 }, (_, i) => makeNodeId(i + 1))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.11 v2 contract — widget imperative state writes', () => {
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

  describe('WidgetHandle.setValue(v) — controlled value write (S4.W4)', () => {
    it('WidgetHandle.setValue(v) dispatches a SetWidgetValue command with the correct value', () => {
      let widgetHandle: { setValue: (v: unknown) => void } | undefined

      defineNodeExtension({
        name: 'bc11.v2.set-value',
        nodeCreated(handle) {
          const wh = handle.addWidget('INT', 'steps', 20, {})
          widgetHandle = wh
        }
      })

      const id = makeNodeId(1)
      stubNodeType(id)
      mountExtensionsForNode(id)

      widgetHandle!.setValue(42)

      const setCmd = dispatchedCommands.find(
        (c) => c.type === 'SetWidgetValue' && c.value === 42
      )
      expect(setCmd).toBeDefined()
    })

    it('setValue dispatches with the widgetId matching the created widget', () => {
      const capturedWidgetId: string[] = []

      defineNodeExtension({
        name: 'bc11.v2.set-value-id',
        nodeCreated(handle) {
          const wh = handle.addWidget('FLOAT', 'cfg', 7.0, {})
          capturedWidgetId.push(wh.entityId as string)
          wh.setValue(8.5)
        }
      })

      const id = makeNodeId(2)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const setCmd = dispatchedCommands.find((c) => c.type === 'SetWidgetValue') as
        | { widgetId: string; value: unknown }
        | undefined

      expect(setCmd).toBeDefined()
      expect(setCmd?.widgetId).toBe(capturedWidgetId[0])
      expect(setCmd?.value).toBe(8.5)
    })

    it('successive setValue calls each dispatch a separate SetWidgetValue command', () => {
      defineNodeExtension({
        name: 'bc11.v2.multi-set-value',
        nodeCreated(handle) {
          const wh = handle.addWidget('INT', 'seed', 0, {})
          wh.setValue(1)
          wh.setValue(2)
          wh.setValue(3)
        }
      })

      const id = makeNodeId(3)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const setCmds = dispatchedCommands.filter((c) => c.type === 'SetWidgetValue')
      expect(setCmds).toHaveLength(3)
      expect(setCmds.map((c) => c.value)).toEqual([1, 2, 3])
    })
  })

  describe('WidgetHandle.setHidden / setDisabled — display state writes (S4.W4)', () => {
    it('WidgetHandle.setHidden(true) dispatches SetWidgetOption with key "hidden" = true', () => {
      defineNodeExtension({
        name: 'bc11.v2.set-hidden',
        nodeCreated(handle) {
          const wh = handle.addWidget('BOOLEAN', 'show_advanced', false, {})
          wh.setHidden(true)
        }
      })

      const id = makeNodeId(4)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const cmd = dispatchedCommands.find(
        (c) => c.type === 'SetWidgetOption' && c.key === 'hidden' && c.value === true
      )
      expect(cmd).toBeDefined()
    })

    it('WidgetHandle.setDisabled(true) dispatches SetWidgetOption with key "disabled" = true', () => {
      defineNodeExtension({
        name: 'bc11.v2.set-disabled',
        nodeCreated(handle) {
          const wh = handle.addWidget('STRING', 'lora_name', '', {})
          wh.setDisabled(true)
        }
      })

      const id = makeNodeId(5)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const cmd = dispatchedCommands.find(
        (c) => c.type === 'SetWidgetOption' && c.key === 'disabled' && c.value === true
      )
      expect(cmd).toBeDefined()
    })
  })

  describe('WidgetHandle.setOption — COMBO and generic option replacement (S4.W5)', () => {
    it('setOption dispatches a SetWidgetOption command with the given key and value', () => {
      defineNodeExtension({
        name: 'bc11.v2.set-option',
        nodeCreated(handle) {
          const wh = handle.addWidget('COMBO', 'sampler_name', 'euler', { values: ['euler', 'dpm_2'] })
          wh.setOption('values', ['euler', 'dpm_2', 'lcm'])
        }
      })

      const id = makeNodeId(6)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const cmd = dispatchedCommands.find(
        (c) => c.type === 'SetWidgetOption' && c.key === 'values'
      ) as { value: unknown[] } | undefined

      expect(cmd).toBeDefined()
      expect(cmd?.value).toContain('lcm')
    })

    it('multiple setOption calls each produce separate SetWidgetOption commands', () => {
      defineNodeExtension({
        name: 'bc11.v2.multi-option',
        nodeCreated(handle) {
          const wh = handle.addWidget('STRING', 'label', '', {})
          wh.setOption('placeholder', 'Enter text')
          wh.setOption('maxLength', 256)
        }
      })

      const id = makeNodeId(7)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const optCmds = dispatchedCommands.filter((c) => c.type === 'SetWidgetOption')
      const keys = optCmds.map((c) => c.key)
      expect(keys).toContain('placeholder')
      expect(keys).toContain('maxLength')
    })
  })

  describe('NodeHandle.addWidget — managed widget list mutation (S2.N16)', () => {
    it('addWidget dispatches a CreateWidget command and returns a handle with the given name', () => {
      let handleName: string | undefined

      defineNodeExtension({
        name: 'bc11.v2.add-widget',
        nodeCreated(handle) {
          const wh = handle.addWidget('INT', 'steps', 20, {})
          handleName = wh.name
        }
      })

      const id = makeNodeId(8)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const createCmd = dispatchedCommands.find(
        (c) => c.type === 'CreateWidget' && c.name === 'steps'
      )
      expect(createCmd).toBeDefined()
      expect(handleName).toBe('steps')
    })

    it('addWidget for each of two distinct widgets produces two independent CreateWidget commands', () => {
      defineNodeExtension({
        name: 'bc11.v2.add-two-widgets',
        nodeCreated(handle) {
          handle.addWidget('INT', 'steps', 20, {})
          handle.addWidget('FLOAT', 'cfg', 7.0, {})
        }
      })

      const id = makeNodeId(9)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const createCmds = dispatchedCommands.filter((c) => c.type === 'CreateWidget')
      const names = createCmds.map((c) => c.name)
      expect(names).toContain('steps')
      expect(names).toContain('cfg')
      expect(createCmds).toHaveLength(2)
    })

    it('addWidget carries the defaultValue in the CreateWidget command', () => {
      defineNodeExtension({
        name: 'bc11.v2.add-widget-default',
        nodeCreated(handle) {
          handle.addWidget('INT', 'seed', 42, {})
        }
      })

      const id = makeNodeId(10)
      stubNodeType(id)
      mountExtensionsForNode(id)

      const createCmd = dispatchedCommands.find(
        (c) => c.type === 'CreateWidget' && c.name === 'seed'
      ) as { defaultValue: unknown } | undefined

      expect(createCmd?.defaultValue).toBe(42)
    })
  })

  describe('Phase B deferred', () => {
    it.todo(
      'WidgetHandle.setValue(v) fires the on("valueChange") listeners with {newValue, oldValue} in the same tick (Phase B — requires reactive World)'
    )
    it.todo(
      'WidgetHandle.setOption({ values }) that removes current value triggers on("valueChange") with reset to options[0] (Phase B)'
    )
    it.todo(
      'NodeHandle.addWidget auto-reflows node size and updates widgets_values named map (Phase B — requires ECS node dimensions component)'
    )
    it.todo(
      'NodeHandle.addWidget does not cause widgets_values positional drift because v2 uses a named map rather than a positional array (Phase B)'
    )
  })
})
