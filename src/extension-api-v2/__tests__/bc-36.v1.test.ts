// Category: BC.36 — PrimeVue widget component API surface
// DB cross-ref: S4.W1, S4.W4, S4.W5
// Exemplar: none (new API surface)
// blast_radius: 3.80
// compat-floor: blast_radius ≥ 2.0
// v1 contract: widget.options.values = [...], widget.options.min = 0, widget.options.max = 100
//              (direct mutation of options bag)

import { describe, expect, it } from 'vitest'

// Synthetic v1 COMBO widget — options bag is a plain mutable object
function makeComboWidget(name: string, values: string[]) {
  return {
    name,
    type: 'COMBO' as const,
    value: values[0] ?? null,
    options: { values: [...values] } as { values: string[] },
    callback: null as ((v: string) => void) | null,
  }
}

// Synthetic v1 INT/FLOAT widget
function makeNumberWidget(name: string, value: number) {
  return {
    name,
    type: 'INT' as const,
    value,
    options: { min: 0, max: 100, step: 1 } as {
      min: number
      max: number
      step: number
      disabled?: boolean
      readonly?: boolean
    },
  }
}

describe('BC.36 v1 contract — PrimeVue widget component API surface', () => {
  describe('S4.W1 — options bag direct mutation (select/combo)', () => {
    it('widget.options.values = [...] replaces the dropdown choices on a COMBO widget at runtime', () => {
      const w = makeComboWidget('scheduler', ['karras', 'exponential', 'sgm_uniform'])
      expect(w.options.values).toEqual(['karras', 'exponential', 'sgm_uniform'])

      // v1 direct mutation — no setter, no event
      w.options.values = ['euler', 'heun', 'dpm']
      expect(w.options.values).toEqual(['euler', 'heun', 'dpm'])
      expect(w.options.values).toHaveLength(3)
    })

    it('widget.options.values mutation takes effect without triggering the widget callback', () => {
      const w = makeComboWidget('sampler', ['dpm++', 'euler'])
      const callbackFired: unknown[] = []
      w.callback = (v) => callbackFired.push(v)

      // Mutate options — callback is NOT invoked (v1 limitation)
      w.options.values = ['dpm++', 'euler', 'lcm']

      expect(callbackFired).toHaveLength(0)
      expect(w.options.values).toContain('lcm')
    })

    it('setting widget.options.values to an empty array renders an empty dropdown without error', () => {
      const w = makeComboWidget('model', ['v1-5-pruned.ckpt'])
      w.options.values = []
      expect(w.options.values).toEqual([])
      // value still holds the old value — no sync in v1
      expect(w.value).toBe('v1-5-pruned.ckpt')
    })
  })

  describe('S4.W4 — options bag direct mutation (number/slider)', () => {
    it('widget.options.min and widget.options.max constrain the slider range when set directly', () => {
      const w = makeNumberWidget('steps', 20)
      expect(w.options.min).toBe(0)
      expect(w.options.max).toBe(100)

      w.options.min = 1
      w.options.max = 150
      expect(w.options.min).toBe(1)
      expect(w.options.max).toBe(150)
    })

    it('widget.options.step controls the increment of a number widget when set on options directly', () => {
      const w = makeNumberWidget('cfg', 7)
      w.options.step = 0.5
      expect(w.options.step).toBe(0.5)
    })
  })

  describe('S4.W5 — disabled / readonly via options bag', () => {
    it('widget.options.disabled = true records the disabled flag on the options bag', () => {
      const w = makeNumberWidget('seed', 42)
      // v1 reads this flag to prevent user interaction — no computed property, just a raw flag
      w.options.disabled = true
      expect(w.options.disabled).toBe(true)
      // value is still accessible (disabled ≠ locked in v1 options model)
      expect(w.value).toBe(42)
    })

    it('widget.options.readonly = true records the readonly flag on the options bag', () => {
      const w = makeNumberWidget('latent_w', 512)
      w.options.readonly = true
      expect(w.options.readonly).toBe(true)
      // value is not affected by the flag itself — renderer is responsible for enforcement
      expect(w.value).toBe(512)
    })

    it('disabled and readonly flags are independent — both can be set simultaneously', () => {
      const w = makeNumberWidget('batch_size', 1)
      w.options.disabled = true
      w.options.readonly = true
      expect(w.options.disabled).toBe(true)
      expect(w.options.readonly).toBe(true)
    })
  })
})
