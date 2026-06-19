import { beforeEach, describe, expect, it } from 'vitest'

import {
  consumePreferAppTemplates,
  setPreferAppTemplates
} from '@/platform/workflow/templates/preferAppTemplates'

const KEY = 'Comfy.Onboarding.PreferAppTemplates'

describe('preferAppTemplates', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a true preference and clears it on read', () => {
    setPreferAppTemplates(true)
    expect(localStorage.getItem(KEY)).toBe('true')

    expect(consumePreferAppTemplates()).toBe(true)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('returns false for a false preference', () => {
    setPreferAppTemplates(false)
    expect(consumePreferAppTemplates()).toBe(false)
  })

  it('returns false when nothing was stored', () => {
    expect(consumePreferAppTemplates()).toBe(false)
  })

  it('is one-time: a second read returns false', () => {
    setPreferAppTemplates(true)

    expect(consumePreferAppTemplates()).toBe(true)
    expect(consumePreferAppTemplates()).toBe(false)
  })
})
