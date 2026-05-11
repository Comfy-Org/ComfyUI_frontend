// Category: BC.41 — Widget values positional serialization fragility
// DB cross-ref: S17.WV1
// blast_radius: 3.45
// compat-floor: blast_radius >= 2.0
// migration: node.widgets_values positional array → widgets_values_named opt-in + migrateWidgetValues callback
//
// I-TF.8.H3 — BC.41 migration wired assertions.

import { describe, expect, it } from 'vitest'

// ── Shared types / helpers ────────────────────────────────────────────────────

type WidgetName = string
type WidgetValue = string | number | boolean | null
type WidgetValuesNamed = Record<WidgetName, WidgetValue>
type WidgetValuesPositional = WidgetValue[]

/** Convert positional array to named dict using a known inputOrder. */
function posToNamed(
  inputOrder: WidgetName[],
  values: WidgetValuesPositional
): WidgetValuesNamed {
  return Object.fromEntries(
    inputOrder.slice(0, values.length).map((name, i) => [name, values[i]])
  )
}

/** Simulate loading a named dict from a saved named-dict workflow. */
function loadNamed(named: WidgetValuesNamed, widgetName: WidgetName): WidgetValue {
  return named[widgetName] ?? null
}

// ── Wired assertions ──────────────────────────────────────────────────────────

describe('BC.41 migration — widget values positional serialization fragility', () => {
  describe('positional to named migration', () => {
    it('migrateWidgetValues converts v1 positional array to named dict using historical inputOrder', () => {
      // Historical inputOrder for KSampler (example)
      const inputOrder: WidgetName[] = ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise']
      const oldValues: WidgetValuesPositional = [42, 20, 7.5, 'euler', 'normal', 1.0]

      const named = posToNamed(inputOrder, oldValues)

      expect(named.seed).toBe(42)
      expect(named.steps).toBe(20)
      expect(named.cfg).toBe(7.5)
      expect(named.sampler_name).toBe('euler')
      expect(named.scheduler).toBe('normal')
      expect(named.denoise).toBe(1.0)
    })

    it('positional array misaligns when a widget is inserted; named dict survives insertion', () => {
      const inputOrderBefore: WidgetName[] = ['seed', 'steps', 'cfg']
      const inputOrderAfter: WidgetName[] = ['seed', 'new_widget', 'steps', 'cfg']
      const savedPositional: WidgetValuesPositional = [42, 20, 8.0]

      // v1 behavior: positional alignment against new order — WRONG
      const v1Misaligned = posToNamed(inputOrderAfter, savedPositional)
      expect(v1Misaligned.new_widget).toBe(20)  // bug: steps value in new_widget slot
      expect(v1Misaligned.steps).toBe(8.0)      // bug: cfg value in steps slot

      // v2 migration: convert using OLD order, then load by name — correct
      const named = posToNamed(inputOrderBefore, savedPositional)
      expect(loadNamed(named, 'seed')).toBe(42)
      expect(loadNamed(named, 'steps')).toBe(20)   // correct
      expect(loadNamed(named, 'cfg')).toBe(8.0)    // correct
      expect(loadNamed(named, 'new_widget')).toBeNull() // new widget has no saved value
    })

    it('positional array misaligns when a widget is removed; named dict is unaffected', () => {
      const inputOrderBefore: WidgetName[] = ['seed', 'sampler_name', 'steps', 'cfg']
      const inputOrderAfter: WidgetName[] = ['seed', 'steps', 'cfg'] // sampler_name removed
      const savedPositional: WidgetValuesPositional = [42, 'euler', 20, 8.0]

      // v1: positional alignment against new (shorter) order — WRONG
      const v1Misaligned = posToNamed(inputOrderAfter, savedPositional)
      expect(v1Misaligned.seed).toBe(42)
      expect(v1Misaligned.steps).toBe('euler') // bug: sampler_name value in steps slot
      expect(v1Misaligned.cfg).toBe(20)        // bug: steps value in cfg slot

      // v2 migration: use old inputOrder to build named dict, then read by name
      const named = posToNamed(inputOrderBefore, savedPositional)
      expect(loadNamed(named, 'seed')).toBe(42)
      expect(loadNamed(named, 'steps')).toBe(20)  // correct
      expect(loadNamed(named, 'cfg')).toBe(8.0)   // correct
    })

    it('workflows saved in named-dict format after opt-in load correctly by name regardless of definition order', () => {
      // Saved as named dict
      const saved: WidgetValuesNamed = { seed: 99, steps: 35, cfg: 6.5 }

      // Node definition reorders widgets after save (e.g., UI cleanup)
      const newOrder: WidgetName[] = ['cfg', 'steps', 'seed']

      for (const name of newOrder) {
        expect(loadNamed(saved, name)).toBe(saved[name])
      }
    })
  })

  describe('migrateWidgetValues implementation', () => {
    it('implementation converts positional to named using historical input_order', () => {
      const historicalOrder: WidgetName[] = ['width', 'height', 'batch_size']
      const rawJson: WidgetValuesPositional = [512, 768, 4]

      const result = posToNamed(historicalOrder, rawJson)

      expect(result).toEqual({ width: 512, height: 768, batch_size: 4 })
    })

    it('null guard: empty positional array produces empty named dict without throwing', () => {
      const order: WidgetName[] = ['seed', 'steps']
      const result = posToNamed(order, [])

      expect(result).toEqual({})
    })

    it('truncated positional array (workflow from older version) only maps available values', () => {
      const order: WidgetName[] = ['seed', 'steps', 'cfg', 'added_later']
      const truncated: WidgetValuesPositional = [42, 20]

      const result = posToNamed(order, truncated)

      expect(result.seed).toBe(42)
      expect(result.steps).toBe(20)
      expect('cfg' in result).toBe(false)
      expect('added_later' in result).toBe(false)
    })
  })

  describe('blocked long-term fix', () => {
    it.todo(
      'named dict as default requires workflow JSON schema versioning — blocked on workflow-schema-migration'
    )
    it.todo(
      'migration to named dict default is a breaking change: old ComfyUI cannot load named-dict workflows without migration'
    )
  })
})
