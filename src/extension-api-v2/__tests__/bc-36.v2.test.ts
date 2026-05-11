// Category: BC.36 — PrimeVue widget component API surface
// DB cross-ref: S4.W1, S4.W4, S4.W5
// Exemplar: none (new API surface)
// blast_radius: 3.80
// compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v2 contract: typed WidgetHandle.setOptions<SliderOptions>({ min, max, step })
//              15 PrimeVue components: Button, InputText, Select, ColorPicker, MultiSelect,
//              SelectButton, Slider, Textarea, ToggleSwitch, Chart, Image, ImageCompare,
//              Galleria, FileUpload, TreeSelect
//              Exclusion rule: strip style/class/dt/pt/*Class/*Style
//              disabled/readonly map to D7 first-class fields, not options bag

import { beforeEach, describe, expect, it } from 'vitest'

// ── Typed options subsets per widget type ─────────────────────────────────────
// Mirrors the D7 Pick<> subsets — only the allowed keys.

interface SelectOptions {
  values?: string[]
  placeholder?: string
  filter?: boolean
}

interface SliderOptions {
  min?: number
  max?: number
  step?: number
  orientation?: 'horizontal' | 'vertical'
}

interface InputTextOptions {
  maxlength?: number
  placeholder?: string
}

// Excluded keys (style/class/pt/dt variants) — tested via runtime rejection
const EXCLUDED_KEYS = ['style', 'class', 'pt', 'dt', 'inputStyle', 'inputClass', 'panelStyle', 'panelClass']

// ── WidgetHandle simulation ───────────────────────────────────────────────────

type WidgetType = 'Select' | 'Slider' | 'InputText' | 'MultiSelect' | 'SelectButton'

interface WidgetState {
  options: Record<string, unknown>
  disabled: boolean
  readonly: boolean
}

const ALLOWED_KEYS: Record<WidgetType, Set<string>> = {
  Select: new Set(['values', 'placeholder', 'filter']),
  Slider: new Set(['min', 'max', 'step', 'orientation']),
  InputText: new Set(['maxlength', 'placeholder']),
  MultiSelect: new Set(['values', 'placeholder', 'filter', 'maxSelectedLabels']),
  SelectButton: new Set(['values', 'multiple', 'unselectable'])
}

function makeWidgetHandle(type: WidgetType, initialValue: unknown = null) {
  const state: WidgetState = { options: {}, disabled: false, readonly: false }
  const valueHolder = { value: initialValue }

  return {
    get type() { return type },
    get value() { return valueHolder.value },
    setValue(v: unknown) { valueHolder.value = v },
    setOptions(opts: Record<string, unknown>): void {
      const allowed = ALLOWED_KEYS[type]
      for (const key of Object.keys(opts)) {
        if (EXCLUDED_KEYS.includes(key)) {
          throw new Error(`[v2] setOptions: key '${key}' is excluded (style/class/pt/dt not allowed)`)
        }
        if (!allowed.has(key)) {
          throw new Error(`[v2] setOptions: key '${key}' is not valid for widget type '${type}'`)
        }
        state.options[key] = opts[key]
      }
    },
    setDisabled(v: boolean) { state.disabled = v },
    setReadOnly(v: boolean) { state.readonly = v },
    getOption<T>(key: string): T { return state.options[key] as T },
    isDisabled() { return state.disabled },
    isReadOnly() { return state.readonly }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.36 v2 contract — PrimeVue widget component API surface', () => {
  describe('S4.W1 — Select/MultiSelect/SelectButton options', () => {
    it('setOptions<SelectOptions>({ values: [...] }) replaces the dropdown choices', () => {
      const widget = makeWidgetHandle('Select')
      widget.setOptions({ values: ['euler', 'dpm_2', 'heun'] })
      expect(widget.getOption<string[]>('values')).toEqual(['euler', 'dpm_2', 'heun'])
    })

    it('setOptions on a Select widget accepts only the allowed subset (no style/class/pt)', () => {
      const widget = makeWidgetHandle('Select')

      // Valid keys pass
      expect(() => widget.setOptions({ values: ['a'], placeholder: 'Choose', filter: true })).not.toThrow()

      // Excluded keys throw
      expect(() => widget.setOptions({ style: 'color:red' })).toThrow('excluded')
      expect(() => widget.setOptions({ class: 'my-class' })).toThrow('excluded')
      expect(() => widget.setOptions({ pt: {} })).toThrow('excluded')
    })

    it('passing an unknown option key throws a runtime error (TS compile-time + runtime guard)', () => {
      const widget = makeWidgetHandle('Select')
      // 'min' is valid for Slider, not Select
      expect(() => widget.setOptions({ min: 0 } as unknown as SelectOptions)).toThrow("'min'")
    })

    it('MultiSelect accepts values, filter, maxSelectedLabels', () => {
      const widget = makeWidgetHandle('MultiSelect')
      expect(() =>
        widget.setOptions({ values: ['a', 'b'], filter: true, maxSelectedLabels: 3 })
      ).not.toThrow()
      expect(widget.getOption<number>('maxSelectedLabels')).toBe(3)
    })

    it('SelectButton accepts values, multiple, unselectable', () => {
      const widget = makeWidgetHandle('SelectButton')
      expect(() => widget.setOptions({ values: ['yes', 'no'], multiple: false, unselectable: true })).not.toThrow()
      expect(widget.getOption<boolean>('unselectable')).toBe(true)
    })
  })

  describe('S4.W4 — Slider options', () => {
    it('setOptions<SliderOptions>({ min, max, step }) updates slider bounds', () => {
      const widget = makeWidgetHandle('Slider')
      widget.setOptions({ min: 1, max: 100, step: 5 })

      expect(widget.getOption<number>('min')).toBe(1)
      expect(widget.getOption<number>('max')).toBe(100)
      expect(widget.getOption<number>('step')).toBe(5)
    })

    it('Slider accepts orientation option', () => {
      const widget = makeWidgetHandle('Slider')
      widget.setOptions({ orientation: 'vertical' })
      expect(widget.getOption<string>('orientation')).toBe('vertical')
    })

    it('setOptions on Slider rejects style/class/pt keys per exclusion rule', () => {
      const widget = makeWidgetHandle('Slider')
      expect(() => widget.setOptions({ style: 'width:200px' })).toThrow('excluded')
      expect(() => widget.setOptions({ inputStyle: 'color:red' })).toThrow('excluded')
    })

    it('Slider does not accept Select-specific keys (values, filter)', () => {
      const widget = makeWidgetHandle('Slider')
      expect(() => widget.setOptions({ values: ['a'] } as unknown as SliderOptions)).toThrow("'values'")
      expect(() => widget.setOptions({ filter: true } as unknown as SliderOptions)).toThrow("'filter'")
    })
  })

  describe('S4.W5 — disabled / readonly as D7 first-class fields', () => {
    it('setDisabled(true) is the v2 replacement for widget.options.disabled = true', () => {
      const widget = makeWidgetHandle('Select')
      expect(widget.isDisabled()).toBe(false)

      widget.setDisabled(true)
      expect(widget.isDisabled()).toBe(true)

      widget.setDisabled(false)
      expect(widget.isDisabled()).toBe(false)
    })

    it('setReadOnly(true) is the v2 replacement for widget.options.readonly = true', () => {
      const widget = makeWidgetHandle('InputText')
      expect(widget.isReadOnly()).toBe(false)

      widget.setReadOnly(true)
      expect(widget.isReadOnly()).toBe(true)
    })

    it('disabled and readonly are NOT accepted as setOptions keys — they are separate methods', () => {
      const widget = makeWidgetHandle('Select')

      // 'disabled' is not in the allowed set for Select → throws
      expect(() => widget.setOptions({ disabled: true } as unknown as SelectOptions)).toThrow("'disabled'")
      expect(() => widget.setOptions({ readonly: true } as unknown as SelectOptions)).toThrow("'readonly'")
    })

    it('setDisabled/setReadOnly are independent; one does not affect the other', () => {
      const widget = makeWidgetHandle('InputText')
      widget.setDisabled(true)
      widget.setReadOnly(false)

      expect(widget.isDisabled()).toBe(true)
      expect(widget.isReadOnly()).toBe(false)
    })
  })
})
