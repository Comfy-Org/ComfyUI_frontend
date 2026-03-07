import { describe, expect, it } from 'vitest'

import { createGridStyle } from './gridUtil'

describe('createGridStyle', () => {
  it('returns default grid styles', () => {
    const style = createGridStyle()
    expect(style.display).toBe('grid')
    expect(style.gap).toBe('1rem')
    expect(style.padding).toBe('0')
    expect(style.gridTemplateColumns).toContain('auto-fill')
  })

  it('uses fixed columns when specified', () => {
    const style = createGridStyle({ columns: 3 })
    expect(style.gridTemplateColumns).toBe('repeat(3, 1fr)')
  })

  it('clamps columns to at least 1', () => {
    const style = createGridStyle({ columns: -1 })
    expect(style.gridTemplateColumns).toBe('repeat(1, 1fr)')
  })

  it('applies custom minWidth and gap', () => {
    const style = createGridStyle({ minWidth: '20rem', gap: '2rem' })
    expect(style.gridTemplateColumns).toContain('20rem')
    expect(style.gap).toBe('2rem')
  })
})
