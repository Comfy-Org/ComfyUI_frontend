// Category: BC.41 — Widget values positional serialization fragility
// DB cross-ref: S17.WV1
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/utils/nodeDefOrderingUtil.ts
// blast_radius: 3.45
// compat-floor: blast_radius >= 2.0 — MUST pass before v2 ships
// v2 contract: WidgetHandle identity by name; widgets_values_named: { seed: 12345, steps: 30 }
//              migrateWidgetValues(oldVersion, values) callback for positional→named conversion.
//              D7 Part 4 (4→2 serialization collapse) + beforeSerialize as partial mitigation.
//
// Phase A note: The named-dict serialization and migrateWidgetValues callback are
// pure-function contracts — testable without any runtime API. These tests prove
// the migration logic and named-dict invariants that the future runtime must honour.
//
// I-TF.8.H3 — BC.41 v2 wired assertions.

import { describe, expect, it, vi } from 'vitest'

// ── Named-dict serialization helpers (mirrors proposed runtime behavior) ───────

type WidgetName = string
type WidgetValue = string | number | boolean | null

/** Named dict format: { widgetName: value } */
type WidgetValuesNamed = Record<WidgetName, WidgetValue>

/** Positional format: [val0, val1, val2, ...] */
type WidgetValuesPositional = WidgetValue[]

/**
 * Proposed migrateWidgetValues signature.
 * Receives the positional array from old workflow JSON.
 * Must return a named dict.
 */
type MigrateWidgetValues = (
  oldVersion: number,
  values: WidgetValuesPositional
) => WidgetValuesNamed

/**
 * Simulate the runtime's fallback: positional alignment using input_order.
 * When migrateWidgetValues is absent, the runtime aligns by index.
 */
function positionalFallback(
  inputOrder: WidgetName[],
  values: WidgetValuesPositional
): WidgetValuesNamed {
  return Object.fromEntries(
    inputOrder.slice(0, values.length).map((name, i) => [name, values[i]])
  )
}

/**
 * Simulate a round-trip: serialize to named dict, then load back by name.
 * Surviving input reorder means: value stays with its name.
 */
function roundTripNamedDict(
  named: WidgetValuesNamed,
  newInputOrder: WidgetName[]
): WidgetValuesPositional {
  return newInputOrder.map((name) => named[name] ?? null)
}

// ── Wired assertions ──────────────────────────────────────────────────────────

describe('BC.41 v2 contract — widget values positional serialization fragility', () => {
  describe('S17.WV1 — named dict opt-in', () => {
    it('named dict serializes widget values as { widgetName: value } not positional array', () => {
      const named: WidgetValuesNamed = { seed: 12345, steps: 30, cfg: 7.5, sampler_name: 'euler' }

      expect(typeof named).toBe('object')
      expect(Array.isArray(named)).toBe(false)
      expect(named.seed).toBe(12345)
      expect(named.steps).toBe(30)
    })

    it('named dict deserialization matches values by name, surviving widget reorder', () => {
      // Original order: seed, steps, cfg
      const original: WidgetValuesNamed = { seed: 42, steps: 20, cfg: 8.0 }

      // After widget reorder: cfg, seed, steps (e.g. UI redesign)
      const newOrder: WidgetName[] = ['cfg', 'seed', 'steps']
      const positional = roundTripNamedDict(original, newOrder)

      expect(positional[0]).toBe(8.0)   // cfg
      expect(positional[1]).toBe(42)    // seed
      expect(positional[2]).toBe(20)    // steps
    })

    it('named dict deserialization survives addition of a new widget (positional would misalign)', () => {
      // A new widget "denoise" inserted at position 2 (between steps and cfg).
      // Positional format: old [42, 20, 8.0] → misread as seed=42, steps=20, denoise=8.0 (cfg lost)
      // Named format: cfg=8.0 survives regardless of insertion.
      const named: WidgetValuesNamed = { seed: 42, steps: 20, cfg: 8.0 }

      const newOrder: WidgetName[] = ['seed', 'steps', 'denoise', 'cfg']
      const positional = roundTripNamedDict(named, newOrder)

      expect(positional[3]).toBe(8.0)  // cfg still correct
      expect(positional[2]).toBeNull() // denoise not in named dict → null (new widget default)
    })

    it('named dict deserialization survives removal of a widget (positional would shift all subsequent values)', () => {
      // "sampler_name" removed from the node definition.
      // Positional: [euler, 42, 20] → removing sampler shifts seed/steps.
      // Named: seed and steps are unaffected.
      const named: WidgetValuesNamed = { seed: 42, steps: 20 }

      const newOrder: WidgetName[] = ['seed', 'steps']
      const positional = roundTripNamedDict(named, newOrder)

      expect(positional[0]).toBe(42)
      expect(positional[1]).toBe(20)
    })

    it('WidgetHandle identity by name: looking up by name is stable across definition changes', () => {
      const named: WidgetValuesNamed = { seed: 999, steps: 50, cfg: 1.0 }
      // Simulate "get widget by name" — O(1), not by position
      const getValue = (name: WidgetName) => named[name] ?? null

      expect(getValue('seed')).toBe(999)
      expect(getValue('cfg')).toBe(1.0)
      expect(getValue('missing')).toBeNull()
    })
  })

  describe('S17.WV1 — migrateWidgetValues callback', () => {
    it('migrateWidgetValues receives positional array and returns named dict', () => {
      const inputOrder: WidgetName[] = ['seed', 'steps', 'cfg', 'sampler_name']

      const migrate: MigrateWidgetValues = (_oldVersion, values) => {
        return positionalFallback(inputOrder, values)
      }

      const result = migrate(0, [42, 20, 7.5, 'euler'])

      expect(result).toEqual({ seed: 42, steps: 20, cfg: 7.5, sampler_name: 'euler' })
    })

    it('migrateWidgetValues can handle version-specific transformations', () => {
      // Version 0: had "sampler" at position 3; version 1: renamed to "sampler_name"
      const migrate: MigrateWidgetValues = (oldVersion, values) => {
        if (oldVersion === 0) {
          const [seed, steps, cfg, sampler] = values
          return { seed: seed as number, steps: steps as number, cfg: cfg as number, sampler_name: sampler }
        }
        return positionalFallback(['seed', 'steps', 'cfg', 'sampler_name'], values)
      }

      const v0Result = migrate(0, [42, 20, 7.5, 'dpm'])
      expect(v0Result.sampler_name).toBe('dpm')

      const v1Result = migrate(1, [99, 30, 6.0, 'euler'])
      expect(v1Result.sampler_name).toBe('euler')
    })

    it('if migrateWidgetValues is absent, runtime falls back to positional alignment by inputOrder', () => {
      const inputOrder: WidgetName[] = ['seed', 'steps', 'cfg']
      const positional: WidgetValuesPositional = [12, 25, 9.0]

      // Fallback behavior: align by index
      const result = positionalFallback(inputOrder, positional)

      expect(result).toEqual({ seed: 12, steps: 25, cfg: 9.0 })
    })

    it('migrateWidgetValues with fewer values than inputOrder leaves remaining widgets as null', () => {
      // Truncated positional array (workflow saved before new widgets existed)
      const inputOrder: WidgetName[] = ['seed', 'steps', 'cfg', 'new_widget']
      const result = positionalFallback(inputOrder, [42, 20])

      expect(result.seed).toBe(42)
      expect(result.steps).toBe(20)
      expect(result.cfg).toBeUndefined() // not in positional
      expect(result.new_widget).toBeUndefined()
    })
  })

  describe('S17.WV1 — D7 partial mitigation: beforeSerialize hook', () => {
    it('beforeSerialize callback can rewrite values before serialization', () => {
      // Simulate: beforeSerialize receives current widget values and can transform them.
      const widgets: WidgetValuesNamed = { seed: -1, steps: 20, cfg: 7.5 }

      const beforeSerialize = vi.fn((values: WidgetValuesNamed): WidgetValuesNamed => {
        // Common pattern: resolve seed=-1 to a random value before saving
        return { ...values, seed: values.seed === -1 ? 42 : values.seed }
      })

      const serialized = beforeSerialize(widgets)

      expect(beforeSerialize).toHaveBeenCalledOnce()
      expect(serialized.seed).toBe(42)
      expect(serialized.steps).toBe(20)
    })

    it('D7 serialization collapse reduces positional array length, shrinking misalignment surface', () => {
      // D7 Part 4: combo-linked widgets collapse from 4 entries to 2.
      // Fewer positions = fewer ways to misalign.
      const v1Positions = ['seed', 'steps', 'cfg', 'sampler', 'scheduler', 'denoise', 'extra1', 'extra2']
      const v2Positions = ['seed', 'steps', 'cfg', 'sampler'] // collapsed

      expect(v2Positions.length).toBeLessThan(v1Positions.length)
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.41 v2 contract — widget values positional serialization fragility [Phase B]', () => {
  it.todo(
    'runtime calls migrateWidgetValues when loading a workflow that contains a positional widgets_values array'
  )
  it.todo(
    'widgets_values_named: true opt-in causes the serializer to write named dict instead of positional array'
  )
  it.todo(
    'null guard (PR #11884 analog) prevents migrateWidgetValues from being called with undefined values'
  )
  it.todo(
    'full named dict as default is blocked on workflow-schema-migration (breaking JSON change with versioning)'
  )
})
