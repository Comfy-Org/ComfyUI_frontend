import { describe, expect, it } from 'vitest'

import {
  needsFormButHasNone,
  proveWidgetForm
} from '@/lib/litegraph/src/node/widgetFormProof'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

/**
 * Each case below is a shape measured in the real frontend or in a shipping custom-node pack,
 * not a hypothetical. The invariant under test is one-directional and is the whole point:
 *
 *   **either no form, or a form that agrees. Never a form that disagrees.**
 *
 * A form-carrying node consults no widget catalog, so a wrong form is authoritative and
 * cannot be detected downstream. Every `provable: false` assertion here is therefore a
 * success, not a limitation.
 */

function widget(name: string, extra: Partial<IBaseWidget> = {}): IBaseWidget {
  return { name, type: 'number', value: 0, ...extra } as IBaseWidget
}

/** Serialize the way `serialiseWidgetValues` does, and hand back the array identity. */
function produce(widgets: IBaseWidget[]) {
  const values = widgets
    .filter((w) => w.serialize !== false)
    .map((w) => w.value as unknown)
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
      serializeWidgets: true
    })

    expect(proof.provable).toBe(true)
    expect(proof.order).toEqual(['seed', 'steps'])
    expect(proof.refusal).toBeNull()
  })

  it('counts a widget flagged only in its options bag, because widgets_values does', () => {
    // The trap that would have shipped a wrong form. `options.serialize === false` excludes a
    // widget from the API prompt but NOT from widgets_values, and `addWidget` does not hoist
    // the flag. Reading the options bag here yields an order one slot short of the values.
    // Measured: every KSampler serializes 7 values because `control_after_generate` is
    // options-bag-only, and every LoadImage serializes 2 because its upload button is.
    const widgets = [
      widget('seed', { value: 1 }),
      widget('control_after_generate', {
        value: 'randomize',
        options: { serialize: false }
      })
    ]
    const { values, serialised } = produce(widgets)

    expect(values).toHaveLength(2)
    const proof = proveWidgetForm(widgets, serialised, values, {
      serializeWidgets: true
    })

    expect(proof.provable).toBe(true)
    expect(proof.order).toEqual(['seed', 'control_after_generate'])
  })

  it('excludes a widget flagged on the widget itself, because widgets_values does too', () => {
    const widgets = [
      widget('audio', { value: 'clip.mp3' }),
      widget('audioUI', { serialize: false })
    ]
    const { values, serialised } = produce(widgets)

    const proof = proveWidgetForm(widgets, serialised, values, {
      serializeWidgets: true
    })

    expect(proof.provable).toBe(true)
    expect(proof.order).toEqual(['audio'])
  })

  describe('refuses rather than guessing', () => {
    it('when a subclass or extension replaced the array after we wrote it', () => {
      // SubgraphNode.serializeFromStoreState calls super -- hook included -- and then
      // rebuilds widgets_values from `inputs` filtered to those carrying a widgetId. That is
      // a different collection from node.widgets, so an order derived from node.widgets
      // describes the wrong thing. Identity, not deep equality, is what catches it.
      const widgets = [widget('a', { value: 1 }), widget('b', { value: 2 })]
      const { values } = produce(widgets)
      const replaced = { widgets_values: [1, 2] } // equal-looking, different array

      const proof = proveWidgetForm(widgets, replaced, values, {
        serializeWidgets: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('values_replaced')
      expect(proof.order).toBeNull()
    })

    it('when a subgraph deleted the values entirely', () => {
      // The `delete serialized.widgets_values` branch, taken when every promoted store value
      // is undefined. A non-empty order beside no values would promise addresses for nothing.
      const widgets = [widget('promoted_a'), widget('promoted_b')]
      const { values } = produce(widgets)

      const proof = proveWidgetForm(widgets, {}, values, {
        serializeWidgets: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.order).toBeNull()
    })

    it('when an extension replaced the array with an object', () => {
      // The VHS family: onSerialize sets widgets_values to a dict keyed by every widget name,
      // including ones flagged serialize === false, so the keys and any derived order differ.
      const widgets = [
        widget('video', { value: 'clip.mp4' }),
        widget('vhslatentpreview', { serialize: false })
      ]
      const { values } = produce(widgets)
      const dict = {
        widgets_values: { video: 'clip.mp4', vhslatentpreview: {}, crf: 23 }
      }

      const proof = proveWidgetForm(widgets, dict, values, {
        serializeWidgets: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('values_not_positional')
    })

    it('when the payload was replayed from a previous save', () => {
      // An unregistered node type is replayed verbatim and never reaches the hook, and its
      // widgets are synthesised placeholders built FROM the stored values. A form there would
      // read order: ['UNKNOWN', 'UNKNOWN_1'] -- valid, authoritative, meaningless.
      const widgets = [
        widget('UNKNOWN', { value: 1 }),
        widget('UNKNOWN_1', { value: 2 })
      ]
      const { values, serialised } = produce(widgets)

      const proof = proveWidgetForm(widgets, serialised, values, {
        serializeWidgets: true,
        replayed: true
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
        { serializeWidgets: true }
      )

      expect(proof.refusal).toBe('replayed_serialization')
    })

    it('when serialize_widgets is falsy', () => {
      // `this.serialize_widgets = false` is in the low hundreds of repositories -- rgthree's
      // group muters, was-node-suite's fast groups, Crystools' debugger. Widgets exist and no
      // values are written.
      const widgets = [widget('mode'), widget('filter')]

      const proof = proveWidgetForm(widgets, {}, undefined, {
        serializeWidgets: false
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('widgets_not_serialized')
    })

    it('when the widget list was spliced after the values were written', () => {
      const widgets = [widget('a', { value: 1 }), widget('b', { value: 2 })]
      const { values, serialised } = produce(widgets)
      widgets.pop() // a pack truncating node.widgets mid-serialize

      const proof = proveWidgetForm(widgets, serialised, values, {
        serializeWidgets: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('length_mismatch')
    })

    it('when two serializing widgets share a name', () => {
      // Measured in the corpus: RecordAudio stores 2 values under 1 name, LoadAudio 3 under
      // 2. `serialiseWidgetValues` collapses them via defineProperty, and the document
      // rejects the second address outright, so an order listing both promises an address
      // that does not resolve.
      const widgets = [
        widget('audio', { value: 'a' }),
        widget('audio', { value: 'b' })
      ]
      const { values, serialised } = produce(widgets)

      const proof = proveWidgetForm(widgets, serialised, values, {
        serializeWidgets: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('duplicate_widget_name')
    })

    it('when a widget has no usable name', () => {
      const widgets = [widget('ok', { value: 1 }), widget('', { value: 2 })]
      const { values, serialised } = produce(widgets)

      const proof = proveWidgetForm(widgets, serialised, values, {
        serializeWidgets: true
      })

      expect(proof.provable).toBe(false)
      expect(proof.refusal).toBe('unnameable_widget')
    })
  })

  it('never returns an order alongside a refusal', () => {
    // The one-directional invariant, asserted directly: no refusal path may leak a partial
    // order, because a caller that reads `order` without checking `provable` would then emit
    // a wrong form -- the exact outcome this module prevents.
    const widgets = [widget('dup', { value: 1 }), widget('dup', { value: 2 })]
    const { values, serialised } = produce(widgets)

    for (const proof of [
      proveWidgetForm(widgets, serialised, values, { serializeWidgets: true }),
      proveWidgetForm(widgets, serialised, values, {
        serializeWidgets: true,
        replayed: true
      }),
      proveWidgetForm(widgets, { widgets_values: { a: 1 } }, values, {
        serializeWidgets: true
      }),
      proveWidgetForm(widgets, {}, undefined, { serializeWidgets: false }),
      proveWidgetForm(undefined, {}, undefined, { serializeWidgets: true })
    ]) {
      expect(proof.provable).toBe(false)
      expect(proof.order).toBeNull()
      expect(proof.refusal).not.toBeNull()
    }
  })
})

describe('needsFormButHasNone', () => {
  it('flags an object-shaped payload with no form', () => {
    // This is the population a form would rescue and that nothing can currently count: stored
    // whole and opaquely, round-trips but is not name-addressable, and the follower drops it
    // because it only accepts an array.
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
