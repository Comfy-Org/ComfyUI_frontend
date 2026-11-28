import { describe, expect, it } from 'vitest'

import { SkillPacksApiError } from './skillsApi'
import { skillPacksReporting } from './skillPacksReporting'

describe('skillPacksReporting', () => {
  it('keeps a 401 (ended or not yet established session) out of Sentry', () => {
    expect(
      skillPacksReporting(new SkillPacksApiError('invalid session cookie', 401))
    ).toEqual({ sentryMode: 'never' })
  })

  it('keeps a local loopback-only refusal out of Sentry', () => {
    expect(
      skillPacksReporting(
        new SkillPacksApiError('Open 127.0.0.1', 403, 'agent_loopback_only')
      )
    ).toEqual({ sentryMode: 'never' })
  })

  it.for([
    { name: 'a 403', error: new SkillPacksApiError('forbidden', 403) },
    { name: 'a 500', error: new SkillPacksApiError('boom', 500) },
    { name: 'a plain error', error: new Error('network down') },
    { name: 'a non-error', error: 'invalid session cookie' }
  ])('leaves $name on the default reporting', ({ error }) => {
    expect(skillPacksReporting(error)).toEqual({})
  })
})
