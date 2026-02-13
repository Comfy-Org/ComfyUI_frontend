import { describe, expect, it, vi } from 'vitest'

import { parseProxyWidgets } from './proxyWidget'

describe('parseProxyWidgets', () => {
  it('returns empty array for null/undefined', () => {
    expect(parseProxyWidgets(null as unknown as undefined)).toEqual([])
    expect(parseProxyWidgets(undefined)).toEqual([])
  })

  it('parses valid JSON string', () => {
    const input = JSON.stringify([['widget1', 'target1']])
    expect(parseProxyWidgets(input)).toEqual([['widget1', 'target1']])
  })

  it('passes through valid arrays', () => {
    const input = [
      ['widget1', 'target1'],
      ['widget2', 'target2']
    ]
    expect(parseProxyWidgets(input)).toEqual(input)
  })

  it('returns empty array for malformed JSON strings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(parseProxyWidgets('{not valid json')).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to parse proxyWidgets property as JSON:',
      '{not valid json'
    )

    warnSpy.mockRestore()
  })

  it('throws for invalid structure (valid JSON but wrong shape)', () => {
    expect(() => parseProxyWidgets([['only_one']])).toThrow(
      'Invalid assignment for properties.proxyWidgets'
    )

    expect(() => parseProxyWidgets({ key: 'value' })).toThrow(
      'Invalid assignment for properties.proxyWidgets'
    )
  })
})
