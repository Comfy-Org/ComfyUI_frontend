import { describe, expect, it } from 'vitest'

import { parseProxyWidgets } from './promotionSchema'

describe('parseProxyWidgets', () => {
  describe('valid inputs', () => {
    it('returns empty array for undefined', () => {
      expect(parseProxyWidgets(undefined)).toEqual([])
    })

    it('returns empty array for empty array', () => {
      expect(parseProxyWidgets([])).toEqual([])
    })

    it('parses a single entry', () => {
      expect(parseProxyWidgets([['1', 'seed']])).toEqual([['1', 'seed']])
    })

    it('parses multiple entries', () => {
      const input = [
        ['1', 'seed'],
        ['2', 'steps']
      ]
      expect(parseProxyWidgets(input)).toEqual(input)
    })

    it('parses a JSON string', () => {
      expect(parseProxyWidgets('[["1", "seed"]]')).toEqual([['1', 'seed']])
    })

    it('parses a double-encoded JSON string', () => {
      expect(parseProxyWidgets('"[[\\"1\\", \\"seed\\"]]"')).toEqual([
        ['1', 'seed']
      ])
    })
  })

  describe('invalid inputs (resilient)', () => {
    it('returns empty array for malformed JSON string', () => {
      expect(parseProxyWidgets('not valid json')).toEqual([])
    })

    it('returns empty array for wrong tuple length', () => {
      expect(parseProxyWidgets([['only-one']] as unknown as undefined)).toEqual(
        []
      )
    })

    it('returns empty array for wrong shape', () => {
      expect(
        parseProxyWidgets({ wrong: 'shape' } as unknown as undefined)
      ).toEqual([])
    })

    it('returns empty array for number', () => {
      expect(parseProxyWidgets(42)).toEqual([])
    })

    it('returns empty array for null', () => {
      expect(parseProxyWidgets(null as unknown as undefined)).toEqual([])
    })

    it('returns empty array for empty string', () => {
      expect(parseProxyWidgets('')).toEqual([])
    })
  })
})
