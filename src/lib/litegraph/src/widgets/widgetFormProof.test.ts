import { describe, expect, it } from 'vitest'

import {
  needsFormButHasNone,
  proveWidgetForm
} from '@/lib/litegraph/src/widgets/widgetFormProof'

interface TestWidget {
  name: string
  type: string
  value: unknown
  serialize?: boolean
}

function widget(name: string, extra: Partial<TestWidget> = {}): TestWidget {
  return { name, type: 'number', value: 0, ...extra }
}

function produce(widgets: TestWidget[]) {
  const values = widgets
    .filter((w) => w.serialize !== false)
    .map((w) => w.value)
  return { values, serialised: { widgets_values: values } }
}

describe('proveWidgetForm', () => {
  it('proves an ordinary node whose values it produced itself', () => {
    const widgets = [
      widget('seed', { value: 1 }),
      widget('steps', { value: 20 })
    ]
    const { values, serialised } = produce(widgets)

    const proof = proveWidgetForm(widgets, serialised, values, {
      serializeWidgets: true,
      coreIsLastWriter: true
    })

    expect(proof.provable).toBe(true)
    expect(proof.order).toEqual(['seed', 'steps'])
    expect(proof.refusal).toBeNull()
  })

  describe('refuses rather than guessing', () => {
    it('when a subclass or extension replaced the array with an equal-looking one', () => {
      const widgets = [widget('a', { value: 1 }), widget('b', { value: 2 })]
      const { values } = produce(widgets)
      const replaced = { widgets_values: [1, 2] }

      const proof = proveWidgetForm(widgets, replaced, values, {
        serializeWidgets: true,
        coreIsLastWriter: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('values_replaced')
      expect(proof.order).toBeNull()
    })

    it('when a subgraph deleted the values entirely', () => {
      const widgets = [widget('promoted_a'), widget('promoted_b')]
      const { values } = produce(widgets)

      const proof = proveWidgetForm(widgets, {}, values, {
        serializeWidgets: true,
        coreIsLastWriter: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('values_missing')
      expect(proof.order).toBeNull()
    })

    it('when an extension replaced the array with a name-keyed object', () => {
      const widgets = [
        widget('video', { value: 'clip.mp4' }),
        widget('vhslatentpreview', { serialize: false })
      ]
      const { values } = produce(widgets)
      const dict = {
        widgets_values: { video: 'clip.mp4', vhslatentpreview: {}, crf: 23 }
      }

      const proof = proveWidgetForm(widgets, dict, values, {
        serializeWidgets: true,
        coreIsLastWriter: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('values_not_positional')
    })
  })

  describe('refuses a payload it did not build', () => {
    it('when the payload was replayed from a previous save', () => {
      const widgets = [
        widget('UNKNOWN', { value: 1 }),
        widget('UNKNOWN_1', { value: 2 })
      ]
      const { values, serialised } = produce(widgets)

      const proof = proveWidgetForm(widgets, serialised, values, {
        serializeWidgets: true,
        replayed: true,
        coreIsLastWriter: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('replayed_serialization')
      expect(proof.order).toBeNull()
    })

    it('and also when the replay is signalled by has_errors', () => {
      const widgets = [widget('UNKNOWN', { value: 1 })]
      const { values, serialised } = produce(widgets)

      const proof = proveWidgetForm(
        widgets,
        { ...serialised, has_errors: true },
        values,
        { serializeWidgets: true, coreIsLastWriter: true }
      )

      expect(proof.refusal).toBe('replayed_serialization')
    })
  })

  describe('refuses when the widget list and the values disagree', () => {
    it('when serialize_widgets is falsy', () => {
      const widgets = [widget('mode'), widget('filter')]

      const proof = proveWidgetForm(widgets, {}, undefined, {
        serializeWidgets: false,
        coreIsLastWriter: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('widgets_not_serialized')
    })

    it('when the widget list was spliced after the values were written', () => {
      const widgets = [widget('a', { value: 1 }), widget('b', { value: 2 })]
      const { values, serialised } = produce(widgets)
      widgets.pop()

      const proof = proveWidgetForm(widgets, serialised, values, {
        serializeWidgets: true,
        coreIsLastWriter: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('length_mismatch')
    })

    it('when two serializing widgets share a name', () => {
      const widgets = [
        widget('audio', { value: 'a' }),
        widget('audio', { value: 'b' })
      ]
      const { values, serialised } = produce(widgets)

      const proof = proveWidgetForm(widgets, serialised, values, {
        serializeWidgets: true,
        coreIsLastWriter: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('duplicate_widget_name')
    })

    it('when a widget has no usable name', () => {
      const widgets = [widget('ok', { value: 1 }), widget('', { value: 2 })]
      const { values, serialised } = produce(widgets)

      const proof = proveWidgetForm(widgets, serialised, values, {
        serializeWidgets: true,
        coreIsLastWriter: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('unnameable_widget')
    })
  })

  it('refuses a node whose class can still rewrite the payload', () => {
    const widgets = [
      widget('promoted_a', { value: 1 }),
      widget('promoted_b', { value: 2 })
    ]
    const { values, serialised } = produce(widgets)

    const accepted = proveWidgetForm(widgets, serialised, values, {
      serializeWidgets: true,
      coreIsLastWriter: true
    })
    expect(accepted.provable).toBe(true)

    const proof = proveWidgetForm(widgets, serialised, values, {
      serializeWidgets: true,
      coreIsLastWriter: false
    })

    expect(proof.provable).toBe(false)
    expect(proof.refusal).toBe('class_may_rewrite_payload')
    expect(proof.order).toBeNull()
  })

  it('checks the last writer before any other refusal that also applies', () => {
    const widgets = [widget('dup', { value: 1 }), widget('dup', { value: 2 })]
    const { values, serialised } = produce(widgets)

    const proof = proveWidgetForm(widgets, serialised, values, {
      serializeWidgets: true,
      replayed: true,
      coreIsLastWriter: false
    })

    expect(proof.refusal).toBe('class_may_rewrite_payload')
  })

  it('never returns an order alongside a refusal', () => {
    const widgets = [widget('dup', { value: 1 }), widget('dup', { value: 2 })]
    const { values, serialised } = produce(widgets)

    const proofs = [
      proveWidgetForm(widgets, serialised, values, {
        serializeWidgets: true,
        coreIsLastWriter: true
      }),
      proveWidgetForm(widgets, serialised, values, {
        serializeWidgets: true,
        replayed: true,
        coreIsLastWriter: true
      }),
      proveWidgetForm(widgets, { widgets_values: { a: 1 } }, values, {
        serializeWidgets: true,
        coreIsLastWriter: true
      }),
      proveWidgetForm(widgets, {}, values, {
        serializeWidgets: true,
        coreIsLastWriter: true
      }),
      proveWidgetForm(widgets, {}, undefined, {
        serializeWidgets: false,
        coreIsLastWriter: true
      }),
      proveWidgetForm(undefined, {}, undefined, {
        serializeWidgets: true,
        coreIsLastWriter: true
      })
    ]

    expect(
      proofs.map(({ provable, order, refusal }) => ({
        provable,
        order,
        refusal
      }))
    ).toEqual([
      { provable: false, order: null, refusal: 'duplicate_widget_name' },
      { provable: false, order: null, refusal: 'replayed_serialization' },
      { provable: false, order: null, refusal: 'values_not_positional' },
      { provable: false, order: null, refusal: 'values_missing' },
      { provable: false, order: null, refusal: 'widgets_not_serialized' },
      { provable: false, order: null, refusal: 'widgets_not_serialized' }
    ])
  })
})

describe('needsFormButHasNone', () => {
  it('flags an object-shaped payload with no form', () => {
    expect(needsFormButHasNone({ widgets_values: { video: 'clip.mp4' } })).toBe(
      true
    )
  })

  it('does not flag one that already declares a form', () => {
    expect(
      needsFormButHasNone({
        widgets_values: { video: 'clip.mp4' },
        widgets_values_form: { order: ['video'] }
      })
    ).toBe(false)
  })

  it('does not flag ordinary positional values, or an absent payload', () => {
    expect(needsFormButHasNone({ widgets_values: [1, 2] })).toBe(false)
    expect(needsFormButHasNone({})).toBe(false)
    expect(needsFormButHasNone({ widgets_values: null })).toBe(false)
  })
})
