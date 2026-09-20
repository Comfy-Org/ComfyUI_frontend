import { describe, expect, it } from 'vitest'

import { parseWidgetValues, serialisedWidgetSlots } from './nodePayload'

describe('parseWidgetValues', () => {
  it.for([
    { label: 'undefined', raw: undefined },
    { label: 'null', raw: null },
    { label: 'a number', raw: 7 },
    { label: 'a string', raw: 'seed' }
  ])('treats $label as omitted', ({ raw }) => {
    expect(parseWidgetValues(raw)).toEqual({ kind: 'omitted' })
  })

  it('reads an array positionally, including an empty one', () => {
    expect(parseWidgetValues([])).toEqual({ kind: 'positional', values: [] })
    expect(parseWidgetValues([4, 4])).toEqual({
      kind: 'positional',
      values: [4, 4]
    })
  })

  it('reads a record by name, including an empty one', () => {
    expect(parseWidgetValues({})).toEqual({ kind: 'named', values: new Map() })
    expect(parseWidgetValues({ steps: 4, seed: 4 })).toEqual({
      kind: 'named',
      values: new Map([
        ['steps', 4],
        ['seed', 4]
      ])
    })
  })

  it('detaches parsed values from the payload', () => {
    const raw = { prompt: { text: 'a cat' } }
    const parsed = parseWidgetValues(raw)
    raw.prompt.text = 'a dog'
    expect(parsed.kind === 'named' && parsed.values.get('prompt')).toEqual({
      text: 'a cat'
    })
  })
})

describe('serialisedWidgetSlots', () => {
  it('emits nothing for an omitted payload', () => {
    expect(serialisedWidgetSlots({ kind: 'omitted' })).toEqual({})
  })

  it('keeps positional values in widgets_values only', () => {
    const slots = serialisedWidgetSlots({
      kind: 'positional',
      values: [21, 'a cat']
    })
    expect(slots).toEqual({ widgets_values: [21, 'a cat'] })
    expect(slots).not.toHaveProperty('widgets_values_named')
  })

  it('moves named values to widgets_values_named and leaves widgets_values unset', () => {
    const slots = serialisedWidgetSlots({
      kind: 'named',
      values: new Map<string, number | string>([
        ['steps', 21],
        ['prompt', 'a cat']
      ])
    })
    expect(slots).toEqual({
      widgets_values_named: { steps: 21, prompt: 'a cat' }
    })
    expect(slots).not.toHaveProperty('widgets_values')
  })

  it('hands parsed positional values over without re-cloning them', () => {
    const nested = { tags: ['a'], size: { w: 1 } }
    const slots = serialisedWidgetSlots({
      kind: 'positional',
      values: [nested]
    })
    // parseWidgetValues is the only detachment boundary; the slot shares the
    // already-detached value rather than paying for a second structuredClone.
    expect(slots.widgets_values?.[0]).toBe(nested)
  })

  it('hands parsed named values over without re-cloning them', () => {
    const nested = { tags: ['a'], size: { w: 1 } }
    const slots = serialisedWidgetSlots({
      kind: 'named',
      values: new Map([['options', nested]])
    })
    expect(slots.widgets_values_named?.options).toBe(nested)
  })

  it('detaches the wire payload exactly once across parse and slots', () => {
    const wire = { options: { tags: ['a'] } }
    const slots = serialisedWidgetSlots(parseWidgetValues(wire))
    wire.options.tags.push('b')
    expect(slots.widgets_values_named).toEqual({ options: { tags: ['a'] } })
  })

  it('round-trips through parseWidgetValues without changing shape', () => {
    for (const raw of [[1, 2], { a: 1, b: 2 }, undefined]) {
      const once = serialisedWidgetSlots(parseWidgetValues(raw))
      const twice = serialisedWidgetSlots(
        parseWidgetValues(once.widgets_values ?? once.widgets_values_named)
      )
      expect(twice).toEqual(once)
    }
  })
})
