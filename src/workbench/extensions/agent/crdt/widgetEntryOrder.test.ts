import { describe, expect, it, vi } from 'vitest'

import { orderWidgetEntries, overflowWidgetIndex } from './widgetEntryOrder'

describe('orderWidgetEntries', () => {
  it.for([
    {
      name: 'orders mounted names before aliases and unresolved names',
      liveNames: ['mode', 'mode.a', 'mode.b'],
      names: ['later', '_extra_2', 'mode.b', '_extra_0', 'mode', 'mode.a'],
      expected: ['mode', 'mode.a', 'mode.b', '_extra_0', '_extra_2', 'later']
    },
    {
      name: 'sorts aliases numerically rather than lexicographically',
      liveNames: ['mode'],
      names: ['_extra_10', '_extra_2', '_extra_0'],
      expected: ['_extra_0', '_extra_2', '_extra_10']
    },
    {
      name: 'prefers a real alias-shaped widget name to its positional rank',
      liveNames: ['_extra_9', 'mode'],
      names: ['_extra_0', 'mode', '_extra_9'],
      expected: ['_extra_9', 'mode', '_extra_0']
    },
    {
      name: 'keeps unknown and malformed alias names in insertion order',
      liveNames: ['mode'],
      names: ['later', '_extra_01', '_extra_-1', 'mode', 'last'],
      expected: ['mode', 'later', '_extra_01', '_extra_-1', 'last']
    },
    {
      name: 'orders aliases even when no widget is mounted',
      liveNames: [],
      names: ['later', '_extra_2', 'last', '_extra_0'],
      expected: ['_extra_0', '_extra_2', 'later', 'last']
    },
    {
      name: 'treats Object.prototype names as ordinary widget names',
      liveNames: ['__proto__', 'constructor', 'toString'],
      names: ['toString', 'constructor', '__proto__'],
      expected: ['__proto__', 'constructor', 'toString']
    },
    {
      name: 'retains the first matching position for repeated live names',
      liveNames: ['first', 'second', 'first'],
      names: ['second', 'first'],
      expected: ['first', 'second']
    },
    {
      name: 'preserves the existing unresolved sentinel for huge aliases',
      liveNames: ['mode'],
      names: ['_extra_9007199254740992', 'later', 'mode'],
      expected: ['mode', 'later', '_extra_9007199254740992']
    },
    {
      name: 'accepts an empty document',
      liveNames: ['mode'],
      names: [],
      expected: []
    }
  ])('$name', ({ liveNames, names, expected }) => {
    const entries = names.map((name): [string, unknown] => [name, name])

    expect(
      orderWidgetEntries(liveNames, entries).map(([name]) => name)
    ).toEqual(expected)
  })

  it('preserves values and does not reorder the input array', () => {
    const objectValue = { prompt: 'unchanged' }
    const entries: [string, unknown][] = [
      ['later', undefined],
      ['steps', null],
      ['prompt', objectValue]
    ]
    const original = entries.slice()
    Object.freeze(entries)

    const ordered = orderWidgetEntries(['prompt', 'steps'], entries)

    expect(ordered).toEqual([
      ['prompt', objectValue],
      ['steps', null],
      ['later', undefined]
    ])
    expect(ordered[0]?.[1]).toBe(objectValue)
    expect(entries).toEqual(original)
  })

  it('reads the live name index once rather than during comparisons', () => {
    const firstName = vi.fn(() => 'mode')
    const liveNames = ['mode', 'steps', 'cfg']
    Object.defineProperty(liveNames, 0, { get: firstName })
    const entries = Object.entries({ cfg: 3, _extra_0: 4, steps: 2, mode: 1 })

    expect(orderWidgetEntries(liveNames, entries)).toEqual([
      ['mode', 1],
      ['steps', 2],
      ['cfg', 3],
      ['_extra_0', 4]
    ])
    expect(firstName).toHaveBeenCalledOnce()
  })

  it('uses the new live order on the next call', () => {
    const entries: [string, unknown][] = [
      ['first', 1],
      ['second', 2]
    ]

    expect(orderWidgetEntries(['first', 'second'], entries)).toEqual(entries)
    expect(orderWidgetEntries(['second', 'first'], entries)).toEqual([
      ['second', 2],
      ['first', 1]
    ])
  })
})

describe('overflowWidgetIndex', () => {
  it.for([
    { name: '_extra_0', expected: 0 },
    { name: '_extra_12', expected: 12 },
    { name: '_extra_01', expected: null },
    { name: '_extra_-1', expected: null },
    { name: '_extra_1.5', expected: null },
    { name: 'mode', expected: null }
  ])('parses $name', ({ name, expected }) => {
    expect(overflowWidgetIndex(name)).toBe(expected)
  })
})
