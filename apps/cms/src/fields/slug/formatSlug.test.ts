import { describe, expect, it } from 'vitest'

import { formatSlug } from './formatSlug'

describe('formatSlug', () => {
  it('folds accented letters to their ASCII base', () => {
    expect(formatSlug('Café')).toBe('cafe')
    expect(formatSlug('Événement 2026')).toBe('evenement-2026')
  })

  it('returns an empty string for a title with no Latin characters', () => {
    expect(formatSlug('你好')).toBe('')
  })

  it('collapses separator runs and trims edge hyphens', () => {
    expect(formatSlug('  My Event: Part 2!  ')).toBe('my-event-part-2')
  })
})
