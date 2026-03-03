import { describe, expect, it } from 'vitest'

import { nextUniqueName, parseSlotTypes } from '@/lib/litegraph/src/strings'

describe('parseSlotTypes', () => {
  it('returns ["*"] for empty string', () => {
    expect(parseSlotTypes('')).toEqual(['*'])
  })

  it('returns ["*"] for "0"', () => {
    expect(parseSlotTypes('0')).toEqual(['*'])
  })

  it('returns ["*"] for numeric 0', () => {
    expect(parseSlotTypes(0)).toEqual(['*'])
  })

  it('lowercases a single type', () => {
    expect(parseSlotTypes('IMAGE')).toEqual(['image'])
  })

  it('splits comma-delimited types and lowercases each', () => {
    expect(parseSlotTypes('INT,FLOAT,STRING')).toEqual([
      'int',
      'float',
      'string'
    ])
  })

  it('passes through already lowercase types unchanged', () => {
    expect(parseSlotTypes('latent')).toEqual(['latent'])
  })
})

describe('nextUniqueName', () => {
  it('returns the original name when there are no conflicts', () => {
    expect(nextUniqueName('foo', ['bar', 'baz'])).toBe('foo')
  })

  it('appends _1 when the name already exists', () => {
    expect(nextUniqueName('foo', ['foo'])).toBe('foo_1')
  })

  it('appends _2 when both name and name_1 exist', () => {
    expect(nextUniqueName('foo', ['foo', 'foo_1'])).toBe('foo_2')
  })

  it('returns the original name with an empty existingNames array', () => {
    expect(nextUniqueName('foo', [])).toBe('foo')
  })

  it('returns the original name when existingNames is omitted', () => {
    expect(nextUniqueName('foo')).toBe('foo')
  })
})
