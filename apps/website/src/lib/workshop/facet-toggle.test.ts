import { describe, expect, it } from 'vitest'

import { toggleIn, toggleOption } from './facet-toggle'

const OPTIONS = [{ value: 'run' }, { value: 'api' }] as const

describe('toggleIn', () => {
  it.for([
    ['adds a value that is not selected', ['a'], 'b', ['a', 'b']],
    ['removes a value that is selected', ['a', 'b'], 'a', ['b']],
    ['selects into an empty list', [], 'a', ['a']]
  ] as const)('%s', ([, selected, value, expected]) => {
    expect(toggleIn(selected, value)).toEqual(expected)
  })

  it('leaves the given list untouched', () => {
    const selected = ['a']
    toggleIn(selected, 'b')
    expect(selected).toEqual(['a'])
  })
})

describe('toggleOption', () => {
  it('toggles a value the options offer', () => {
    expect(toggleOption(OPTIONS, ['run'], 'api')).toEqual(['run', 'api'])
    expect(toggleOption(OPTIONS, ['run', 'api'], 'run')).toEqual(['api'])
  })

  it.for([
    ['a value the options do not offer', OPTIONS, 'download'],
    ['missing options', undefined, 'run']
  ] as const)('keeps the same selection for %s', ([, options, value]) => {
    const selected: ('run' | 'api')[] = ['run']
    expect(toggleOption(options, selected, value)).toBe(selected)
  })
})
