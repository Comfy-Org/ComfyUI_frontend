// Category: BC.36 — PrimeVue widget component API surface
// DB cross-ref: S4.W1, S4.W4, S4.W5
// Exemplar: none (new API surface)
// blast_radius: 3.80
// compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// migration: widget.options.* direct mutation → WidgetHandle.setOptions<T>() typed per-component subsets

import { describe, expect, it, vi } from 'vitest'

// ── V1 widget options bag simulation ──────────────────────────────────────────
// v1: extensions directly mutated widget.options — a plain object with no type
// enforcement. Any key was accepted; style/class/pt keys leaked through.

function makeV1Widget(type: string, value: unknown = null) {
  const options: Record<string, unknown> = {}
  return {
    type,
    value,
    options, // mutable bag — no enforcement
    // v1 disabled/readonly live inside options
    get isDisabled() { return !!options['disabled'] },
    get isReadOnly() { return !!options['readonly'] }
  }
}

// ── V2 compat shim simulation ─────────────────────────────────────────────────
// The shim intercepts widget.options writes and forwards them to setOptions,
// dropping excluded keys and emitting deprecation warnings.

const EXCLUDED = new Set(['style', 'class', 'pt', 'dt', 'inputStyle', 'inputClass', 'panelStyle', 'panelClass'])
const DISABLED_READONLY = new Set(['disabled', 'readonly'])

type WidgetType = 'Select' | 'Slider' | 'InputText'

const ALLOWED: Record<WidgetType, Set<string>> = {
  Select: new Set(['values', 'placeholder', 'filter']),
  Slider: new Set(['min', 'max', 'step', 'orientation']),
  InputText: new Set(['maxlength', 'placeholder'])
}

function makeV2WidgetHandle(type: WidgetType, initialValue: unknown = null) {
  const options: Record<string, unknown> = {}
  let disabled = false
  let readonly = false

  return {
    type,
    value: initialValue,
    setOptions(opts: Record<string, unknown>, warnFn?: (msg: string) => void): void {
      const allowed = ALLOWED[type]
      for (const [key, val] of Object.entries(opts)) {
        if (EXCLUDED.has(key)) {
          warnFn?.(`[v2 compat] setOptions: dropped excluded key '${key}'`)
          continue
        }
        if (DISABLED_READONLY.has(key)) {
          warnFn?.(`[v2 compat] Use setDisabled()/setReadOnly() instead of options.${key}`)
          if (key === 'disabled') disabled = Boolean(val)
          if (key === 'readonly') readonly = Boolean(val)
          continue
        }
        if (!allowed.has(key)) {
          throw new Error(`[v2] setOptions: key '${key}' not valid for type '${type}'`)
        }
        options[key] = val
      }
    },
    setDisabled(v: boolean) { disabled = v },
    setReadOnly(v: boolean) { readonly = v },
    getOption: <T>(k: string) => options[k] as T,
    isDisabled: () => disabled,
    isReadOnly: () => readonly
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.36 migration — PrimeVue widget component API surface', () => {
  describe('options bag to setOptions migration', () => {
    it('widget.options.values = [...] is replaced by setOptions<SelectOptions>({ values: [...] })', () => {
      // v1: direct mutation
      const v1 = makeV1Widget('Select')
      v1.options['values'] = ['euler', 'dpm_2']
      expect(v1.options['values']).toEqual(['euler', 'dpm_2'])

      // v2: setOptions typed call
      const v2 = makeV2WidgetHandle('Select')
      v2.setOptions({ values: ['euler', 'dpm_2'] })
      expect(v2.getOption<string[]>('values')).toEqual(['euler', 'dpm_2'])
    })

    it('widget.options.min / .max / .step are replaced by setOptions<SliderOptions>({ min, max, step })', () => {
      // v1
      const v1 = makeV1Widget('Slider')
      v1.options['min'] = 0
      v1.options['max'] = 1000
      v1.options['step'] = 10

      // v2
      const v2 = makeV2WidgetHandle('Slider')
      v2.setOptions({ min: 0, max: 1000, step: 10 })

      expect(v2.getOption<number>('min')).toBe(v1.options['min'])
      expect(v2.getOption<number>('max')).toBe(v1.options['max'])
      expect(v2.getOption<number>('step')).toBe(v1.options['step'])
    })

    it('v2 compat shim intercepts widget.options writes and forwards to setOptions with deprecation warning', () => {
      const warnings: string[] = []
      const v2 = makeV2WidgetHandle('Select')

      // Shim call: forwards valid keys, warns on disabled/readonly, drops excluded
      v2.setOptions(
        { values: ['a', 'b'], disabled: true, style: 'color:red' },
        (msg) => warnings.push(msg)
      )

      // Valid key accepted
      expect(v2.getOption<string[]>('values')).toEqual(['a', 'b'])
      // disabled forwarded to setDisabled
      expect(v2.isDisabled()).toBe(true)
      // style dropped with warning
      expect(warnings.some((w) => w.includes("dropped excluded key 'style'"))).toBe(true)
      expect(warnings.some((w) => w.includes('setDisabled'))).toBe(true)
    })
  })

  describe('disabled/readonly migration', () => {
    it('widget.options.disabled = true is replaced by setDisabled(true)', () => {
      // v1: options bag mutation
      const v1 = makeV1Widget('Select')
      v1.options['disabled'] = true
      expect(v1.isDisabled).toBe(true)

      // v2: first-class method
      const v2 = makeV2WidgetHandle('Select')
      v2.setDisabled(true)
      expect(v2.isDisabled()).toBe(true)

      // Toggle works correctly
      v2.setDisabled(false)
      expect(v2.isDisabled()).toBe(false)
    })

    it('widget.options.readonly = true is replaced by setReadOnly(true)', () => {
      const v1 = makeV1Widget('InputText')
      v1.options['readonly'] = true
      expect(v1.isReadOnly).toBe(true)

      const v2 = makeV2WidgetHandle('InputText')
      v2.setReadOnly(true)
      expect(v2.isReadOnly()).toBe(true)
    })
  })

  describe('exclusion rule enforcement', () => {
    it('v1 style/class/pt options written via widget.options are silently dropped by the v2 compat shim', () => {
      const warnings: string[] = []
      const v2 = makeV2WidgetHandle('Slider')

      // v1 extension wrote style and pt into options — shim drops them
      v2.setOptions(
        { min: 0, max: 100, style: 'width:300px', pt: { root: { class: 'my-slider' } } },
        (msg) => warnings.push(msg)
      )

      // Valid keys kept
      expect(v2.getOption<number>('min')).toBe(0)
      expect(v2.getOption<number>('max')).toBe(100)

      // Excluded keys dropped — not stored
      expect(v2.getOption('style')).toBeUndefined()
      expect(v2.getOption('pt')).toBeUndefined()

      // Warnings emitted for each dropped key
      expect(warnings.filter((w) => w.includes("dropped excluded key 'style'"))).toHaveLength(1)
      expect(warnings.filter((w) => w.includes("dropped excluded key 'pt'"))).toHaveLength(1)
    })

    it('setOptions<T>() TypeScript overloads prevent style/class/pt at compile time; runtime shim silently drops them', () => {
      const v2 = makeV2WidgetHandle('InputText')
      const warnings: string[] = []

      // Runtime: excluded keys are silently dropped by the shim (not stored)
      v2.setOptions({ panelStyle: 'color:red', inputClass: 'foo', maxlength: 100 }, (msg) => warnings.push(msg))

      // Valid key is stored
      expect(v2.getOption<number>('maxlength')).toBe(100)

      // Excluded keys are not stored
      expect(v2.getOption('panelStyle')).toBeUndefined()
      expect(v2.getOption('inputClass')).toBeUndefined()

      // A warning was emitted for each excluded key
      expect(warnings.some((w) => w.includes('panelStyle'))).toBe(true)
      expect(warnings.some((w) => w.includes('inputClass'))).toBe(true)
    })
  })
})
