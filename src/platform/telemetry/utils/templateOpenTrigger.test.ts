import { describe, expect, it } from 'vitest'

import { TemplateOpenTrigger } from '../types'
import { isTemplateOpenTrigger } from './templateOpenTrigger'

describe('isTemplateOpenTrigger', () => {
  it('accepts every known trigger value', () => {
    for (const value of Object.values(TemplateOpenTrigger)) {
      expect(isTemplateOpenTrigger(value)).toBe(true)
    }
  })

  it('rejects unknown or non-string values', () => {
    expect(isTemplateOpenTrigger('starter')).toBe(false)
    expect(isTemplateOpenTrigger('')).toBe(false)
    expect(isTemplateOpenTrigger(undefined)).toBe(false)
    expect(isTemplateOpenTrigger(['shared_url'])).toBe(false)
  })
})
