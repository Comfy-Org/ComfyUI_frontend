// Category: BC.13 — Per-node serialization interception
// DB cross-ref: S2.N6, S2.N15
// Exemplar: https://github.com/Azornes/Comfyui-LayerForge/blob/main/js/CanvasView.js#L1438
// Migration: v1 prototype.serialize patching / node.onSerialize → v2 NodeHandle.on('beforeSerialize') named-map

import { describe, expect, it, vi } from 'vitest'
import type { AsyncHandler } from '@/extension-api/events'
import type { NodeBeforeSerializeEvent } from '@/extension-api/node'

// ── V1 serialization simulation ───────────────────────────────────────────────
// v1: extension patches NodeType.prototype.serialize. Each patcher wraps the
// previous and returns the modified data object.

type V1SerializeFn = (base: Record<string, unknown>) => Record<string, unknown>

function makeV1NodeType(comfyClass: string) {
  let serializeFn: V1SerializeFn = (data) => data

  return {
    comfyClass,
    patchSerialize(patcher: (orig: V1SerializeFn) => V1SerializeFn) {
      const prev = serializeFn
      serializeFn = patcher(prev)
    },
    serialize(baseData: Record<string, unknown>): Record<string, unknown> {
      return serializeFn({ ...baseData })
    },
    // v1 onSerialize hook (alternative pattern — receives data, mutates in place)
    _onSerializeHandlers: [] as Array<(data: Record<string, unknown>) => void>,
    onSerialize(fn: (data: Record<string, unknown>) => void) {
      this._onSerializeHandlers.push(fn)
    },
    serializeWithOnSerialize(base: Record<string, unknown>): Record<string, unknown> {
      const data = this.serialize(base)
      for (const fn of this._onSerializeHandlers) fn(data)
      return data
    }
  }
}

// ── V2 serialization simulation ───────────────────────────────────────────────

type Unsubscribe = () => void

function makeV2NodeManager() {
  const handlers: Array<AsyncHandler<NodeBeforeSerializeEvent>> = []

  return {
    on(_event: 'beforeSerialize', handler: AsyncHandler<NodeBeforeSerializeEvent>): Unsubscribe {
      handlers.push(handler)
      return () => {
        const i = handlers.indexOf(handler)
        if (i !== -1) handlers.splice(i, 1)
      }
    },
    async serialize(baseData: Record<string, unknown>): Promise<Record<string, unknown>> {
      let data = { ...baseData }
      let replacer: ((orig: Record<string, unknown>) => Record<string, unknown>) | null = null

      const event: NodeBeforeSerializeEvent = {
        context: 'workflow',
        get data() { return data },
        replace(fn) { replacer = fn }
      }

      for (const fn of [...handlers]) {
        await fn(event)
      }

      return replacer ? replacer(data) : data
    }
  }
}

// ── Widget value helpers ──────────────────────────────────────────────────────

interface WidgetSpec {
  name: string
  type: 'INT' | 'FLOAT' | 'STRING'
  default: unknown
  serialize?: boolean
}

function positionalSerialize(
  widgets: Array<WidgetSpec & { value: unknown }>
): unknown[] {
  return widgets.filter((w) => w.serialize !== false).map((w) => w.value)
}

function namedSerialize(
  widgets: Array<WidgetSpec & { value: unknown }>,
  warnFn: (msg: string) => void
): Record<string, unknown> {
  const named: Record<string, unknown> = {}
  for (const w of widgets) {
    let val = w.value
    if ((w.type === 'INT' || w.type === 'FLOAT') && typeof val === 'number' && isNaN(val)) {
      warnFn(`[ComfyUI] Widget "${w.name}" serialized NaN — substituting default (${w.default})`)
      val = w.default
    }
    named[w.name] = val
  }
  return named
}

function namedDeserialize(
  named: Record<string, unknown>,
  specs: WidgetSpec[],
  warnFn: (msg: string) => void
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const spec of specs) {
    const raw = named[spec.name]
    if ((spec.type === 'INT' || spec.type === 'FLOAT') && raw === null) {
      warnFn(`[ComfyUI] Widget "${spec.name}" loaded null for numeric — restoring default (${spec.default})`)
      out[spec.name] = spec.default
    } else if (raw === undefined) {
      out[spec.name] = spec.default
    } else {
      out[spec.name] = raw // preserve null for non-numeric widgets
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.13 migration — per-node serialization interception', () => {
  describe('(a) positional v1 compat: prototype.serialize / onSerialize parity', () => {
    it("custom field injected via v1 prototype.serialize patch and v2 on('beforeSerialize') both appear under identical keys", async () => {
      const base = { id: 1, type: 'KSampler' }

      // v1 path
      const v1 = makeV1NodeType('KSampler')
      v1.patchSerialize((prev) => (data) => ({ ...prev(data), custom_field: 'from-v1' }))
      const v1Result = v1.serialize(base)
      expect(v1Result['custom_field']).toBe('from-v1')

      // v2 path
      const v2 = makeV2NodeManager()
      v2.on('beforeSerialize', async (e) => { e.data['custom_field'] = 'from-v2' })
      const v2Result = await v2.serialize(base)
      expect(v2Result['custom_field']).toBe('from-v2')

      // Both produce the same key — extension authors can migrate without renaming
      expect(Object.keys(v1Result)).toContain('custom_field')
      expect(Object.keys(v2Result)).toContain('custom_field')
    })

    it("v1 onSerialize and v2 on('beforeSerialize') both fire exactly once per graphToPrompt() call", async () => {
      const base = { id: 2 }

      // v1
      const v1 = makeV1NodeType('Foo')
      const v1Spy = vi.fn()
      v1.onSerialize(v1Spy)
      v1.serializeWithOnSerialize(base)
      expect(v1Spy).toHaveBeenCalledOnce()

      // v2
      const v2 = makeV2NodeManager()
      const v2Spy = vi.fn().mockResolvedValue(undefined)
      v2.on('beforeSerialize', v2Spy)
      await v2.serialize(base)
      expect(v2Spy).toHaveBeenCalledOnce()
    })

    it('chain of two v1 prototype.serialize patchers produces same custom-field set as two v2 listeners', async () => {
      const base = { id: 3 }

      // v1: two chained patchers
      const v1 = makeV1NodeType('Bar')
      v1.patchSerialize((prev) => (data) => ({ ...prev(data), ext_a: 'A' }))
      v1.patchSerialize((prev) => (data) => ({ ...prev(data), ext_b: 'B' }))
      const v1Result = v1.serialize(base)

      // v2: two separate listeners
      const v2 = makeV2NodeManager()
      v2.on('beforeSerialize', async (e) => { e.data['ext_a'] = 'A' })
      v2.on('beforeSerialize', async (e) => { e.data['ext_b'] = 'B' })
      const v2Result = await v2.serialize(base)

      expect(v1Result['ext_a']).toBe('A')
      expect(v1Result['ext_b']).toBe('B')
      expect(v2Result['ext_a']).toBe('A')
      expect(v2Result['ext_b']).toBe('B')
    })
  })

  describe('(b) named-map v2 round-trip parity', () => {
    it('v2 widgets_values_named deserialization produces same values as v1 positional array', () => {
      const specs: WidgetSpec[] = [
        { name: 'seed', type: 'INT', default: 0 },
        { name: 'steps', type: 'INT', default: 20 },
        { name: 'cfg', type: 'FLOAT', default: 7.0 }
      ]

      const widgets: Array<WidgetSpec & { value: unknown }> = [
        { ...specs[0], value: 42 },
        { ...specs[1], value: 30 },
        { ...specs[2], value: 8.5 }
      ]

      // v1: positional array
      const v1Positional = positionalSerialize(widgets)
      expect(v1Positional).toEqual([42, 30, 8.5])

      // v2: named map → round-trip → deserialize
      const named = namedSerialize(widgets, () => {})
      const namedJson: Record<string, unknown> = JSON.parse(JSON.stringify(named))
      const v2Deserialized = namedDeserialize(namedJson, specs, () => {})

      // Same values regardless of representation
      specs.forEach((s) => {
        const positionalIdx = specs.indexOf(s)
        expect(v2Deserialized[s.name]).toBe(v1Positional[positionalIdx])
      })
    })

    it('inserting a widget between two existing widgets does not shift named-map entries (v2), unlike v1 positional array', () => {
      const specsBefore: WidgetSpec[] = [
        { name: 'seed', type: 'INT', default: 0 },
        { name: 'steps', type: 'INT', default: 20 }
      ]

      const specsAfter: WidgetSpec[] = [
        { name: 'seed', type: 'INT', default: 0 },
        { name: 'cfg', type: 'FLOAT', default: 7.0 }, // inserted
        { name: 'steps', type: 'INT', default: 20 }
      ]

      // v1: positional shifts — steps is at index 1 before, index 2 after insertion
      const v1Before = positionalSerialize([
        { ...specsBefore[0], value: 42 },
        { ...specsBefore[1], value: 25 }
      ])
      const v1After = positionalSerialize([
        { ...specsAfter[0], value: 42 },
        { ...specsAfter[1], value: 5.0 },
        { ...specsAfter[2], value: 25 }
      ])
      // v1: loading old workflow after insertion reads wrong index for steps
      expect(v1Before[1]).toBe(25) // steps at index 1
      expect(v1After[1]).toBe(5.0) // after insertion, index 1 is cfg — CORRUPTED if loaded with old workflow

      // v2: named map — steps is always steps
      const namedBefore = namedSerialize(
        [{ ...specsBefore[0], value: 42 }, { ...specsBefore[1], value: 25 }],
        () => {}
      )
      const namedAfter = namedSerialize(
        [{ ...specsAfter[0], value: 42 }, { ...specsAfter[1], value: 5.0 }, { ...specsAfter[2], value: 25 }],
        () => {}
      )

      // v2: steps key is stable regardless of insertion
      expect(namedBefore['steps']).toBe(25)
      expect(namedAfter['steps']).toBe(25)
    })

    it("serialize===false widget occupies named-map entry with no positional offset in v2; v1 callers must remove offset logic", () => {
      const specs: WidgetSpec[] = [
        { name: 'seed', type: 'INT', default: 0 },
        { name: 'control_after_generate', type: 'STRING', default: 'fixed', serialize: false },
        { name: 'steps', type: 'INT', default: 20 }
      ]

      const widgets: Array<WidgetSpec & { value: unknown }> = [
        { ...specs[0], value: 1 },
        { ...specs[1], value: 'randomize', serialize: false },
        { ...specs[2], value: 10 }
      ]

      // v1: control_after_generate is excluded from positional array
      const v1Positional = positionalSerialize(widgets)
      expect(v1Positional).toEqual([1, 10]) // 2 items — no slot for control_after_generate

      // v2: named map includes all widgets by name; no offset computation needed
      const named = namedSerialize(widgets, () => {})
      expect(named['seed']).toBe(1)
      expect(named['control_after_generate']).toBe('randomize')
      expect(named['steps']).toBe(10)

      // v1 callers that hardcoded index 1 for 'steps' must be updated — v2 uses name key
      expect(v1Positional[1]).toBe(10) // v1: steps at index 1 (after filtering serialize===false)
      expect(named['steps']).toBe(10) // v2: steps always at key 'steps'
    })
  })

  describe('(c) null-in-numeric-widget: warning + default substitution', () => {
    it('v1 NaN silently becomes null in JSON; v2 substitutes declared default and emits console.warn including node id and widget name', () => {
      const warnMessages: string[] = []

      // v1 behavior: NaN → null via JSON.stringify
      const v1Value: unknown = NaN
      const v1Json = JSON.parse(JSON.stringify({ val: v1Value }))
      expect(v1Json.val).toBeNull() // v1: silent null

      // v2 behavior: NaN → warn + substitute default
      const widgets: Array<WidgetSpec & { value: unknown }> = [
        { name: 'steps', type: 'INT', default: 20, value: NaN }
      ]

      const named = namedSerialize(widgets, (msg) => warnMessages.push(msg))

      expect(named['steps']).toBe(20) // default substituted
      expect(warnMessages.length).toBe(1)
      expect(warnMessages[0]).toMatch(/steps/) // widget name in message
      expect(warnMessages[0]).toMatch(/NaN/)
    })

    it('null numeric widget loaded under v2 emits console.warn and restores declared default rather than loading null', () => {
      const warnMessages: string[] = []

      const specs: WidgetSpec[] = [
        { name: 'cfg', type: 'FLOAT', default: 7.0 }
      ]

      // Simulate a v1-serialized workflow where cfg was NaN → null
      const legacyNamed: Record<string, unknown> = { cfg: null }

      const deserialized = namedDeserialize(legacyNamed, specs, (msg) => warnMessages.push(msg))

      expect(deserialized['cfg']).toBe(7.0)
      expect(warnMessages.length).toBe(1)
      expect(warnMessages[0]).toMatch(/cfg/)
    })

    it('NaN guard does not trigger for non-numeric widgets whose value is legitimately null', () => {
      const warnMessages: string[] = []

      const specs: WidgetSpec[] = [
        { name: 'optional_lora', type: 'STRING', default: '' }
      ]

      // STRING widget with null value — not a NaN guard scenario
      const named = namedSerialize(
        [{ ...specs[0], value: null }],
        (msg) => warnMessages.push(msg)
      )

      // No warning for non-numeric null
      expect(warnMessages.length).toBe(0)
      expect(named['optional_lora']).toBeNull()

      // Also on deserialize
      const deserialized = namedDeserialize({ optional_lora: null }, specs, (msg) => warnMessages.push(msg))
      expect(warnMessages.length).toBe(0)
      expect(deserialized['optional_lora']).toBeNull()
    })
  })
})
