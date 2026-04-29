import { describe, expect, it } from 'vitest'

import { getProxyWidgetInlineState, parseProxyWidgets } from './promotionSchema'

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

  it('parses legacy 4-tuple arrays', () => {
    const input = [
      ['3', 'text', '1', { value: 42 }],
      ['9', 'seed', null, { value: 'abc' }]
    ]
    expect(parseProxyWidgets(input)).toEqual(input)
  })

  it('returns empty array for non-array input', () => {
    expect(parseProxyWidgets(undefined)).toEqual([])
    expect(parseProxyWidgets('not-json{')).toEqual([])
  })

  it('returns empty array for invalid tuples', () => {
    expect(parseProxyWidgets([['only-one']])).toEqual([])
    expect(parseProxyWidgets([['a', 'b', 'c', 'd']])).toEqual([])
  })

  it('rejects legacy 4-tuple entries with undefined inline value', () => {
    expect(
      parseProxyWidgets([
        ['3', 'text', null, { value: undefined }] as unknown as [
          string,
          string,
          null,
          { value: undefined }
        ]
      ])
    ).toEqual([])
  })
})

describe(getProxyWidgetInlineState, () => {
  it('returns inline value for 4-tuples only', () => {
    expect(getProxyWidgetInlineState(['1', 'seed'])).toBeUndefined()
    expect(getProxyWidgetInlineState(['1', 'seed', '2'])).toBeUndefined()
    expect(
      getProxyWidgetInlineState(['1', 'seed', null, { value: 10 }])
    ).toEqual({ value: 10 })
  })
})
