import { describe, expect, it } from 'vitest'

import { parseProxyWidgets } from './promotionSchema'

describe(parseProxyWidgets, () => {
  it('parses 2-tuple arrays', () => {
    const input = [
      ['10', 'seed'],
      ['11', 'steps']
    ]
    expect(parseProxyWidgets(input)).toEqual([
      ['10', 'seed'],
      ['11', 'steps']
    ])
  })

  it('parses 3-tuple arrays', () => {
    const input = [
      ['3', 'text', '1'],
      ['3', 'text', '2']
    ]
    expect(parseProxyWidgets(input)).toEqual([
      ['3', 'text', '1'],
      ['3', 'text', '2']
    ])
  })

  it('parses mixed 2-tuple and 3-tuple arrays', () => {
    const input = [
      ['10', 'seed'],
      ['3', 'text', '1']
    ]
    expect(parseProxyWidgets(input)).toEqual([
      ['10', 'seed'],
      ['3', 'text', '1']
    ])
  })

  it('returns empty array for non-array input', () => {
    expect(parseProxyWidgets(undefined)).toEqual([])
    expect(parseProxyWidgets('not-json{')).toEqual([])
  })

  it('returns empty array for invalid tuples', () => {
    expect(parseProxyWidgets([['only-one']])).toEqual([])
    expect(parseProxyWidgets([['a', 'b', 'c', 'd']])).toEqual([])
  })
})
