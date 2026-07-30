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
  it('returns an empty map when widgetsValues is undefined', () => {
    const shadow = computeLegacyWidgetShadow([makeWidget('steps')], undefined)
    expect(shadow.size).toBe(0)
  })

  it('maps widgets to values positionally', () => {
    const widgets = [makeWidget('steps'), makeWidget('seed')]
    const shadow = computeLegacyWidgetShadow(widgets, [30, 12345])
    expect(shadow).toEqual(
      new Map([
        ['steps', 30],
        ['seed', 12345]
      ])
    )
  })

  it('skips widgets with serialize: false, matching the legacy loop', () => {
    const widgets = [
      makeWidget('steps'),
      makeWidget('action', false),
      makeWidget('seed')
    ]
    const shadow = computeLegacyWidgetShadow(widgets, [30, 12345])
    expect(shadow).toEqual(
      new Map([
        ['steps', 30],
        ['seed', 12345]
      ])
    )
  })

  it('stops once widgetsValues is exhausted', () => {
    const widgets = [makeWidget('steps'), makeWidget('seed')]
    const shadow = computeLegacyWidgetShadow(widgets, [30])
    expect(shadow).toEqual(new Map([['steps', 30]]))
  })
})

describe('diffNamedValuesShadow', () => {
  it('returns null when there is no legacy data to compare', () => {
    expect(diffNamedValuesShadow({ steps: 30 }, new Map())).toBeNull()
  })

  it('reports no mismatch when named and legacy agree', () => {
    const legacy = new Map([
      ['steps', 30],
      ['seed', 12345]
    ])
    const result = diffNamedValuesShadow({ steps: 30, seed: 12345 }, legacy)
    expect(result).toEqual({ mismatchWidgetCount: 0, checkedWidgetCount: 2 })
  })

  it('reports a genuine mismatch', () => {
    const legacy = new Map([
      ['steps', 30],
      ['seed', 12345]
    ])
    const result = diffNamedValuesShadow({ steps: 15, seed: 12345 }, legacy)
    expect(result).toEqual({ mismatchWidgetCount: 1, checkedWidgetCount: 2 })
  })

  it('counts a value the named map is missing entirely as a mismatch', () => {
    const legacy = new Map([
      ['steps', 30],
      ['seed', 12345]
    ])
    const result = diffNamedValuesShadow({ steps: 30 }, legacy)
    expect(result).toEqual({ mismatchWidgetCount: 1, checkedWidgetCount: 2 })
  })

  it('counts a value the legacy walk is missing entirely as a mismatch', () => {
    const legacy = new Map([['steps', 30]])
    const result = diffNamedValuesShadow({ steps: 30, prompt: 'hi' }, legacy)
    expect(result).toEqual({ mismatchWidgetCount: 1, checkedWidgetCount: 2 })
  })

  it('uses deep equality for object/array values', () => {
    const legacy = new Map([['tags', ['a', 'b']]])
    const result = diffNamedValuesShadow({ tags: ['a', 'b'] }, legacy)
    expect(result).toEqual({ mismatchWidgetCount: 0, checkedWidgetCount: 1 })
  })
})
