import { describe, expect, it } from 'vitest'
import { toSlug } from './slug'

describe('toSlug', () => {
  it('lowercases and hyphenates words', () => {
    expect(toSlug('Collapsing a KSampler Node')).toBe(
      'collapsing-a-ksampler-node'
    )
  })

  it('collapses runs of non-alphanumeric characters into one hyphen', () => {
    expect(toSlug('queuing  a workflow -- with a missing model!')).toBe(
      'queuing-a-workflow-with-a-missing-model'
    )
  })

  it('trims leading and trailing hyphens', () => {
    expect(toSlug('  --leading and trailing--  ')).toBe('leading-and-trailing')
  })

  it('returns an empty string for input with no alphanumeric characters', () => {
    expect(toSlug('!!!')).toBe('')
  })
})
