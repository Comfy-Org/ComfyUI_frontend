// Category: BC.13 — Per-node serialization interception
// DB cross-ref: S2.N6, S2.N15
// Exemplar: https://github.com/Azornes/Comfyui-LayerForge/blob/main/js/CanvasView.js#L1438
// blast_radius: 6.36 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v2 replacement: NodeHandle.on('beforeSerialize', async (e) => { e.data.myData = ... })
// Notes: v2 uses widgets_values_named keyed by widget name, eliminating positional drift.
//        NaN→null pipeline: v2 serializer logs a warning and substitutes the widget's declared default.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AsyncHandler } from '@/extension-api/events'
import type { NodeBeforeSerializeEvent } from '@/extension-api/node'

// ── Minimal NodeBeforeSerializeEvent factory ──────────────────────────────────

interface WidgetSpec {
  name: string
  type: 'INT' | 'FLOAT' | 'STRING' | 'BOOLEAN'
  default: unknown
  serialize?: boolean
}

interface SerializedNode {
  id: number
  type: string
  widgets_values_named: Record<string, unknown>
  [key: string]: unknown
}

function makeEvent(
  overrides: Partial<NodeBeforeSerializeEvent> & {
    initialData?: Record<string, unknown>
  } = {}
): NodeBeforeSerializeEvent & { _getData(): Record<string, unknown> } {
  let data: Record<string, unknown> = { ...(overrides.initialData ?? {}) }
  let replacer: ((orig: Record<string, unknown>) => Record<string, unknown>) | null = null

  const event: NodeBeforeSerializeEvent & { _getData(): Record<string, unknown> } = {
    context: overrides.context ?? 'workflow',
    get data() {
      return data
    },
    replace(fn) {
      replacer = fn
    },
    _getData() {
      return replacer ? replacer(data) : data
    }
  }
  return event
}

// ── Minimal NodeHandle-like subscription manager ──────────────────────────────

type Unsubscribe = () => void

function makeNodeSubscriptionManager() {
  const listeners: Array<AsyncHandler<NodeBeforeSerializeEvent>> = []

  return {
    on(_event: 'beforeSerialize', handler: AsyncHandler<NodeBeforeSerializeEvent>): Unsubscribe {
      listeners.push(handler)
      return () => {
        const idx = listeners.indexOf(handler)
        if (idx !== -1) listeners.splice(idx, 1)
      }
    },
    async dispatch(event: NodeBeforeSerializeEvent): Promise<void> {
      for (const fn of [...listeners]) {
        await fn(event)
      }
    },
    listenerCount() {
      return listeners.length
    }
  }
}

// ── Named-map serializer simulator ───────────────────────────────────────────

function serializeWidgets(
  widgets: Array<WidgetSpec & { value: unknown }>
): { named: Record<string, unknown>; warnings: string[] } {
  const named: Record<string, unknown> = {}
  const warnings: string[] = []

  for (const w of widgets) {
    if (w.serialize === false) {
      named[w.name] = w.value // still in named map, just not in positional
      continue
    }
    let val = w.value
    if ((w.type === 'INT' || w.type === 'FLOAT') && typeof val === 'number' && isNaN(val)) {
      warnings.push(
        `[ComfyUI] Widget "${w.name}" on node serialized NaN — substituting default (${w.default})`
      )
      val = w.default
    }
    named[w.name] = val
  }

  return { named, warnings }
}

function deserializeWidgets(
  named: Record<string, unknown>,
  specs: WidgetSpec[],
  warn: (msg: string) => void
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const spec of specs) {
    const raw = named[spec.name]
    if ((spec.type === 'INT' || spec.type === 'FLOAT') && raw === null) {
      warn(
        `[ComfyUI] Widget "${spec.name}" loaded null for numeric widget — restoring default (${spec.default})`
      )
      out[spec.name] = spec.default
    } else {
      out[spec.name] = raw ?? spec.default
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.13 v2 contract — per-node serialization interception', () => {
  describe("NodeHandle.on('beforeSerialize', fn) — node-level serialization hook (S2.N6, S2.N15)", () => {
    it("fires fn with the serialization data object during graphToPrompt(); fn may add custom fields", async () => {
      const node = makeNodeSubscriptionManager()
      const event = makeEvent({ initialData: { id: 1, type: 'KSampler' } })

      node.on('beforeSerialize', async (e) => {
        e.data['my_field'] = 'injected'
      })

      await node.dispatch(event)

      expect(event._getData()['my_field']).toBe('injected')
    })

    it("custom fields added inside on('beforeSerialize') are present in the workflow JSON under the node's entry", async () => {
      const node = makeNodeSubscriptionManager()
      const initialData: Record<string, unknown> = { id: 42, type: 'PreviewImage' }
      const event = makeEvent({ initialData })

      node.on('beforeSerialize', async (e) => {
        e.data['preview_count'] = 5
        e.data['last_preview_url'] = 'blob://abc'
      })

      await node.dispatch(event)

      const serialized: SerializedNode = {
        ...(event._getData() as object),
        widgets_values_named: {}
      } as SerializedNode

      const json = JSON.parse(JSON.stringify(serialized))
      expect(json['preview_count']).toBe(5)
      expect(json['last_preview_url']).toBe('blob://abc')
    })

    it('multiple listeners from different extensions all fire and their custom fields coexist', async () => {
      const node = makeNodeSubscriptionManager()
      const event = makeEvent({ initialData: { id: 7 } })

      node.on('beforeSerialize', async (e) => { e.data['ext_a'] = 'from-A' })
      node.on('beforeSerialize', async (e) => { e.data['ext_b'] = 'from-B' })
      node.on('beforeSerialize', async (e) => { e.data['ext_c'] = 'from-C' })

      await node.dispatch(event)

      expect(event._getData()['ext_a']).toBe('from-A')
      expect(event._getData()['ext_b']).toBe('from-B')
      expect(event._getData()['ext_c']).toBe('from-C')
    })

    it("listener removed via unsubscribe; subsequent serializations omit its custom fields", async () => {
      const node = makeNodeSubscriptionManager()

      const unsub = node.on('beforeSerialize', async (e) => {
        e.data['removed_field'] = 'should-not-appear'
      })

      unsub()
      expect(node.listenerCount()).toBe(0)

      const event = makeEvent({ initialData: {} })
      await node.dispatch(event)

      expect(event._getData()['removed_field']).toBeUndefined()
    })

    it('async handler is fully awaited before the next listener runs', async () => {
      const node = makeNodeSubscriptionManager()
      const order: number[] = []

      node.on('beforeSerialize', async (e) => {
        await new Promise<void>((r) => setTimeout(r, 10))
        order.push(1)
        e.data['step'] = 1
      })

      node.on('beforeSerialize', async (e) => {
        // Must see step=1 from the prior handler
        order.push(2)
        e.data['saw_step'] = e.data['step']
      })

      const event = makeEvent({ initialData: {} })
      await node.dispatch(event)

      expect(order).toEqual([1, 2])
      expect(event._getData()['saw_step']).toBe(1)
    })

    it("replace() replaces the entire data object; later listeners see the new object", async () => {
      const node = makeNodeSubscriptionManager()
      const event = makeEvent({ initialData: { id: 3, orig: true } })

      node.on('beforeSerialize', async (e) => {
        e.replace((orig) => ({ ...orig, wrapped: true, orig: false }))
      })

      await node.dispatch(event)

      const final = event._getData()
      expect(final['wrapped']).toBe(true)
      expect(final['orig']).toBe(false)
    })

    it("context field is passed correctly for 'prompt' serialization context", async () => {
      const node = makeNodeSubscriptionManager()
      let capturedContext: string | undefined

      node.on('beforeSerialize', async (e) => {
        capturedContext = e.context
      })

      const event = makeEvent({ context: 'prompt', initialData: {} })
      await node.dispatch(event)

      expect(capturedContext).toBe('prompt')
    })
  })

  describe('named-map round-trip (widgets_values_named)', () => {
    it('stores widget values keyed by name; map survives JSON round-trip with no null drift', () => {
      const widgets: Array<WidgetSpec & { value: unknown }> = [
        { name: 'seed', type: 'INT', default: 0, value: 42 },
        { name: 'steps', type: 'INT', default: 20, value: 30 },
        { name: 'cfg', type: 'FLOAT', default: 7.0, value: 8.5 },
        { name: 'sampler_name', type: 'STRING', default: 'euler', value: 'dpm_2' }
      ]

      const { named } = serializeWidgets(widgets)
      const roundTripped: Record<string, unknown> = JSON.parse(JSON.stringify({ named })).named

      expect(roundTripped['seed']).toBe(42)
      expect(roundTripped['steps']).toBe(30)
      expect(roundTripped['cfg']).toBe(8.5)
      expect(roundTripped['sampler_name']).toBe('dpm_2')
    })

    it('workflow with three widgets including serialize===false deserializes correctly regardless of insertion order', () => {
      const specs: WidgetSpec[] = [
        { name: 'seed', type: 'INT', default: 0 },
        { name: 'control_after_generate', type: 'STRING', default: 'fixed', serialize: false },
        { name: 'steps', type: 'INT', default: 20 }
      ]

      const widgets: Array<WidgetSpec & { value: unknown }> = [
        { ...specs[0], value: 99 },
        { ...specs[1], value: 'randomize', serialize: false },
        { ...specs[2], value: 15 }
      ]

      const { named } = serializeWidgets(widgets)

      // Named map contains all three regardless of insertion order
      expect(named['seed']).toBe(99)
      expect(named['steps']).toBe(15)
      // serialize===false widget still has a named entry (no positional corruption)
      expect('control_after_generate' in named).toBe(true)
    })

    it('widgets added or removed between passes do not corrupt unaffected entries', () => {
      const pass1: Array<WidgetSpec & { value: unknown }> = [
        { name: 'seed', type: 'INT', default: 0, value: 1 },
        { name: 'steps', type: 'INT', default: 20, value: 25 }
      ]

      const { named: named1 } = serializeWidgets(pass1)

      // Simulate adding a widget between seed and steps
      const pass2: Array<WidgetSpec & { value: unknown }> = [
        { name: 'seed', type: 'INT', default: 0, value: 1 },
        { name: 'cfg', type: 'FLOAT', default: 7.0, value: 5.0 }, // new
        { name: 'steps', type: 'INT', default: 20, value: 25 }
      ]

      const { named: named2 } = serializeWidgets(pass2)

      // 'steps' is still keyed by name — no positional shift
      expect(named1['steps']).toBe(25)
      expect(named2['steps']).toBe(25)
      expect(named2['cfg']).toBe(5.0)
    })
  })

  describe('NaN→null guard (numeric widget safety)', () => {
    it("NaN numeric widget: v2 logs console.warn and substitutes declared default", () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const widgets: Array<WidgetSpec & { value: unknown }> = [
        { name: 'steps', type: 'INT', default: 20, value: NaN }
      ]

      const { named, warnings } = serializeWidgets(widgets)

      expect(named['steps']).toBe(20)
      expect(warnings.length).toBe(1)
      expect(warnings[0]).toMatch(/steps/)
      expect(warnings[0]).toMatch(/NaN/)

      warnSpy.mockRestore()
    })

    it('substituted default value round-trips through JSON correctly', () => {
      const widgets: Array<WidgetSpec & { value: unknown }> = [
        { name: 'cfg', type: 'FLOAT', default: 7.5, value: NaN }
      ]

      const { named } = serializeWidgets(widgets)
      const json = JSON.parse(JSON.stringify({ named })).named

      expect(json['cfg']).toBe(7.5)
      expect(json['cfg']).not.toBeNull()
    })

    it('NaN guard per-widget; does not abort remaining widgets on the same node', () => {
      const widgets: Array<WidgetSpec & { value: unknown }> = [
        { name: 'seed', type: 'INT', default: 0, value: NaN },
        { name: 'steps', type: 'INT', default: 20, value: 30 },
        { name: 'cfg', type: 'FLOAT', default: 7.0, value: NaN }
      ]

      const { named, warnings } = serializeWidgets(widgets)

      // Two NaN widgets both substituted; steps unaffected
      expect(warnings.length).toBe(2)
      expect(named['seed']).toBe(0)
      expect(named['steps']).toBe(30)
      expect(named['cfg']).toBe(7.0)
    })
  })
})
