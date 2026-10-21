import { describe, expect, it } from 'vitest'

import { elapsedLabel } from './elapsed'

describe('elapsedLabel', () => {
  it.for([
    { ms: 0, label: '0:00' },
    { ms: 999, label: '0:00' },
    { ms: 56_000, label: '0:56' },
    { ms: 61_500, label: '1:01' },
    { ms: -5, label: '0:00' }
  ])('shows $ms ms as $label', ({ ms, label }) => {
    expect(elapsedLabel(ms)).toBe(label)
  })
})
