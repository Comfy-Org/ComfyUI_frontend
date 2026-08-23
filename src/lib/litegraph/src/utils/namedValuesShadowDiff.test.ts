import { describe, expect, it } from 'vitest'

import type { IBaseWidget } from '../types/widgets'
import {
  computeLegacyWidgetShadow,
  diffNamedValuesShadow
} from './namedValuesShadowDiff'

function makeWidget(name: string, serialize?: boolean): IBaseWidget {
  return { name, serialize } as IBaseWidget
}

describe('computeLegacyWidgetShadow', () => {
  it('returns an empty array when widgetsValues is undefined', () => {
    const shadow = computeLegacyWidgetShadow([makeWidget('steps')], undefined)
    expect(shadow).toEqual([])
  })

  it('maps widgets to values positionally', () => {
    const widgets = [makeWidget('steps'), makeWidget('seed')]
    const shadow = computeLegacyWidgetShadow(widgets, [30, 12345])
    expect(shadow).toEqual([
      { widgetIndex: 0, name: 'steps', value: 30 },
      { widgetIndex: 1, name: 'seed', value: 12345 }
    ])
  })

  it('skips widgets with serialize: false, matching the legacy loop', () => {
    const widgets = [
      makeWidget('steps'),
      makeWidget('action', false),
      makeWidget('seed')
    ]
    const shadow = computeLegacyWidgetShadow(widgets, [30, 12345])
    expect(shadow).toEqual([
      { widgetIndex: 0, name: 'steps', value: 30 },
      { widgetIndex: 2, name: 'seed', value: 12345 }
    ])
  })

  it('stops once widgetsValues is exhausted', () => {
    const widgets = [makeWidget('steps'), makeWidget('seed')]
    const shadow = computeLegacyWidgetShadow(widgets, [30])
    expect(shadow).toEqual([{ widgetIndex: 0, name: 'steps', value: 30 }])
  })

  it('keeps a separate entry per widget instance when names collide', () => {
    const widgets = [makeWidget('scale'), makeWidget('scale')]
    const shadow = computeLegacyWidgetShadow(widgets, [5, 7])
    expect(shadow).toEqual([
      { widgetIndex: 0, name: 'scale', value: 5 },
      { widgetIndex: 1, name: 'scale', value: 7 }
    ])
  })
})

describe('diffNamedValuesShadow', () => {
  it('returns null when there is no legacy data to compare', () => {
    expect(diffNamedValuesShadow({ steps: 30 }, [])).toBeNull()
  })

  it('reports no mismatch when named and legacy agree', () => {
    const legacy = [
      { widgetIndex: 0, name: 'steps', value: 30 },
      { widgetIndex: 1, name: 'seed', value: 12345 }
    ]
    const result = diffNamedValuesShadow({ steps: 30, seed: 12345 }, legacy)
    expect(result).toEqual({ mismatchWidgetCount: 0, checkedWidgetCount: 2 })
  })

  it('reports a genuine mismatch', () => {
    const legacy = [
      { widgetIndex: 0, name: 'steps', value: 30 },
      { widgetIndex: 1, name: 'seed', value: 12345 }
    ]
    const result = diffNamedValuesShadow({ steps: 15, seed: 12345 }, legacy)
    expect(result).toEqual({ mismatchWidgetCount: 1, checkedWidgetCount: 2 })
  })

  it('counts a value the named map is missing entirely as a mismatch', () => {
    const legacy = [
      { widgetIndex: 0, name: 'steps', value: 30 },
      { widgetIndex: 1, name: 'seed', value: 12345 }
    ]
    const result = diffNamedValuesShadow({ steps: 30 }, legacy)
    expect(result).toEqual({ mismatchWidgetCount: 1, checkedWidgetCount: 2 })
  })

  it('counts a value the legacy walk is missing entirely as a mismatch', () => {
    const legacy = [{ widgetIndex: 0, name: 'steps', value: 30 }]
    const result = diffNamedValuesShadow({ steps: 30, prompt: 'hi' }, legacy)
    expect(result).toEqual({ mismatchWidgetCount: 1, checkedWidgetCount: 2 })
  })

  it('uses deep equality for object/array values', () => {
    const legacy = [{ widgetIndex: 0, name: 'tags', value: ['a', 'b'] }]
    const result = diffNamedValuesShadow({ tags: ['a', 'b'] }, legacy)
    expect(result).toEqual({ mismatchWidgetCount: 0, checkedWidgetCount: 1 })
  })

  it('flags a mismatch when duplicate-named widgets disagree with the single named value', () => {
    const widgets = [makeWidget('scale'), makeWidget('scale')]
    const legacy = computeLegacyWidgetShadow(widgets, [5, 7])

    // The named map can only hold one value per name; here it reflects the
    // second widget's value, which silently loses the first widget's real
    // legacy value of 5. Comparing each widget instance individually (rather
    // than collapsing legacy into a name-keyed map) is what surfaces this.
    const result = diffNamedValuesShadow({ scale: 7 }, legacy)
    expect(result).toEqual({ mismatchWidgetCount: 1, checkedWidgetCount: 2 })
  })
})
