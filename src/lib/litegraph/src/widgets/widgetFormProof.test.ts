import { describe, expect, it } from 'vitest'

import {
  needsFormButHasNone,
  proveWidgetForm
} from '@/lib/litegraph/src/widgets/widgetFormProof'

const serializing = { serializeWidgets: true, coreIsLastWriter: true }

describe('proveWidgetForm', () => {
  it('proves an ordinary node whose values it produced itself', () => {
    const widgets = [{ name: 'seed' }, { name: 'steps' }]
    const values = [1, 20]

    const proof = proveWidgetForm(
      widgets,
      { widgets_values: values },
      values,
      serializing
    )

    expect(proof).toEqual({
      provable: true,
      refusal: null,
      order: ['seed', 'steps']
    })
  })

  describe('refuses rather than guessing', () => {
    it('when a subclass or extension replaced the array with an equal-looking one', () => {
      const widgets = [{ name: 'a' }, { name: 'b' }]

      const proof = proveWidgetForm(
        widgets,
        { widgets_values: [1, 2] },
        [1, 2],
        serializing
      )

      expect(proof).toEqual({
        provable: false,
        refusal: 'values_replaced',
        order: null
      })
    })

    it('when a subgraph deleted the values entirely', () => {
      const widgets = [{ name: 'promoted_a' }, { name: 'promoted_b' }]

      const proof = proveWidgetForm(widgets, {}, [0, 0], serializing)

      expect(proof.refusal).toBe('values_missing')
    })

    it('when an extension replaced the array with a name-keyed object', () => {
      const widgets = [
        { name: 'video' },
        { name: 'vhslatentpreview', serialize: false }
      ]

      const proof = proveWidgetForm(
        widgets,
        {
          widgets_values: { video: 'clip.mp4', vhslatentpreview: {}, crf: 23 }
        },
        ['clip.mp4'],
        serializing
      )

      expect(proof.refusal).toBe('values_not_positional')
    })
  })

  describe('refuses a payload it did not build', () => {
    it('when the payload was replayed from a previous save', () => {
      const widgets = [{ name: 'UNKNOWN' }, { name: 'UNKNOWN_1' }]
      const values = [1, 2]

      const proof = proveWidgetForm(
        widgets,
        { widgets_values: values },
        values,
        {
          ...serializing,
          replayed: true
        }
      )

      expect(proof.refusal).toBe('replayed_serialization')
    })

    it('and also when the replay is signalled by has_errors', () => {
      const values = [1]

      const proof = proveWidgetForm(
        [{ name: 'UNKNOWN' }],
        { widgets_values: values, has_errors: true },
        values,
        serializing
      )

      expect(proof.refusal).toBe('replayed_serialization')
    })
  })

  describe('refuses when the widget list and the values disagree', () => {
    it('when serialize_widgets is falsy', () => {
      const proof = proveWidgetForm(
        [{ name: 'mode' }, { name: 'filter' }],
        {},
        undefined,
        { serializeWidgets: false, coreIsLastWriter: true }
      )

      expect(proof.refusal).toBe('widgets_not_serialized')
    })

    it('when every widget is excluded from serialization', () => {
      const values: unknown[] = []

      const proof = proveWidgetForm(
        [{ name: 'preview', serialize: false }],
        { widgets_values: values },
        values,
        serializing
      )

      expect(proof).toEqual({
        provable: false,
        refusal: 'widgets_not_serialized',
        order: null
      })
    })

    it('when the widget list was spliced after the values were written', () => {
      const values = [1, 2]

      const proof = proveWidgetForm(
        [{ name: 'a' }],
        { widgets_values: values },
        values,
        serializing
      )

      expect(proof.refusal).toBe('length_mismatch')
    })

    it('when two serializing widgets share a name', () => {
      const values = ['a', 'b']

      const proof = proveWidgetForm(
        [{ name: 'audio' }, { name: 'audio' }],
        { widgets_values: values },
        values,
        serializing
      )

      expect(proof.refusal).toBe('duplicate_widget_name')
    })

    it('when a widget has no usable name', () => {
      const values = [1, 2]

      const proof = proveWidgetForm(
        [{ name: 'ok' }, { name: '' }],
        { widgets_values: values },
        values,
        serializing
      )

      expect(proof.refusal).toBe('unnameable_widget')
    })
  })

  it('refuses a node whose class can still rewrite the payload', () => {
    const values = [1, 2]

    const proof = proveWidgetForm(
      [{ name: 'promoted_a' }, { name: 'promoted_b' }],
      { widgets_values: values },
      values,
      { serializeWidgets: true, coreIsLastWriter: false }
    )

    expect(proof).toEqual({
      provable: false,
      refusal: 'class_may_rewrite_payload',
      order: null
    })
  })

  it('checks the last writer before any other refusal that also applies', () => {
    const values = [1, 2]

    const proof = proveWidgetForm(
      [{ name: 'dup' }, { name: 'dup' }],
      { widgets_values: values },
      values,
      { serializeWidgets: true, replayed: true, coreIsLastWriter: false }
    )

    expect(proof.refusal).toBe('class_may_rewrite_payload')
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

  it.for([
    { name: 'positional values', serialised: { widgets_values: [1, 2] } },
    { name: 'absent payload', serialised: {} },
    { name: 'null payload', serialised: { widgets_values: null } },
    { name: 'scalar payload', serialised: { widgets_values: 'clip.mp4' } }
  ])('does not flag $name', ({ serialised }) => {
    expect(needsFormButHasNone(serialised)).toBe(false)
  })
})
