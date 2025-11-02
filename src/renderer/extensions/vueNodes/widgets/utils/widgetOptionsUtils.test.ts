import { describe, expect, it } from 'vitest'

import { ensureValueInOptions } from './widgetOptionsUtils'

describe('ensureValueInOptions', () => {
  describe('when value exists in options', () => {
    it('returns original options without duplicates', () => {
      const options = ['option1', 'option2', 'option3']
      const result = ensureValueInOptions(options, 'option2')

      expect(result).toEqual(options)
      expect(result).toHaveLength(3)
    })

    it('handles first option', () => {
      const options = ['first', 'second', 'third']
      const result = ensureValueInOptions(options, 'first')

      expect(result).toEqual(options)
    })

    it('handles last option', () => {
      const options = ['first', 'second', 'third']
      const result = ensureValueInOptions(options, 'third')

      expect(result).toEqual(options)
    })
  })

  describe('when value is missing from options', () => {
    it('prepends missing value to options array', () => {
      const options = ['option1', 'option2', 'option3']
      const result = ensureValueInOptions(options, 'deleted_model.safetensors')

      expect(result).toEqual([
        'deleted_model.safetensors',
        'option1',
        'option2',
        'option3'
      ])
      expect(result).toHaveLength(4)
    })

    it('preserves deserialized workflow values', () => {
      const options = ['current_model.ckpt']
      const oldValue = 'old_model_from_workflow.ckpt'
      const result = ensureValueInOptions(options, oldValue)

      expect(result[0]).toBe(oldValue)
      expect(result).toContain('current_model.ckpt')
    })

    it('handles numeric values', () => {
      const options = [1, 2, 3]
      const result = ensureValueInOptions(options, 99)

      expect(result).toEqual([99, 1, 2, 3])
    })
  })

  describe('when value is null or empty', () => {
    it('returns original options for undefined', () => {
      const options = ['option1', 'option2']
      const result = ensureValueInOptions(options, undefined)

      expect(result).toEqual(options)
    })

    it('returns original options for null', () => {
      const options = ['option1', 'option2']
      const result = ensureValueInOptions(options, null)

      expect(result).toEqual(options)
    })

    it('returns original options for empty string', () => {
      const options = ['option1', 'option2']
      const result = ensureValueInOptions(options, '')

      expect(result).toEqual(options)
    })
  })

  describe('edge cases', () => {
    it('handles empty options array', () => {
      const result = ensureValueInOptions([], 'some_value')

      expect(result).toEqual(['some_value'])
    })

    it('handles options with special characters', () => {
      const options = ['normal.txt', 'with spaces.png', 'special@#$.jpg']
      const result = ensureValueInOptions(
        options,
        'another file with spaces.png'
      )

      expect(result[0]).toBe('another file with spaces.png')
      expect(result).toHaveLength(4)
    })

    it('creates new array instance (does not mutate input)', () => {
      const options = ['option1', 'option2']
      const result = ensureValueInOptions(options, 'option1')

      expect(result).not.toBe(options)
      expect(result).toEqual(options)
    })

    it('handles readonly arrays', () => {
      const options = ['a', 'b', 'c'] as const
      const result = ensureValueInOptions(options, 'd')

      expect(result).toEqual(['d', 'a', 'b', 'c'])
    })
  })
})
