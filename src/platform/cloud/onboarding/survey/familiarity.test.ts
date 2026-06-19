import { describe, expect, it } from 'vitest'

import { prefersAppTemplates } from './familiarity'

describe('prefersAppTemplates', () => {
  it('prefers app templates for users just starting out', () => {
    expect(prefersAppTemplates('new')).toBe(true)
    expect(prefersAppTemplates('starting')).toBe(true)
  })

  it('does not prefer app templates for more experienced users', () => {
    expect(prefersAppTemplates('basics')).toBe(false)
    expect(prefersAppTemplates('advanced')).toBe(false)
    expect(prefersAppTemplates('expert')).toBe(false)
  })

  it('does not prefer app templates when familiarity is missing', () => {
    expect(prefersAppTemplates(undefined)).toBe(false)
    expect(prefersAppTemplates(null)).toBe(false)
  })
})
