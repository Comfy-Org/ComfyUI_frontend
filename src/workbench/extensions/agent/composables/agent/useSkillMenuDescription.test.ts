import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useSkillMenuDescription } from './useSkillMenuDescription'

describe('useSkillMenuDescription', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('leaves no pending hover-close timer after its scope is disposed', () => {
    const scope = effectScope()
    const description = scope.run(() =>
      useSkillMenuDescription(() => undefined)
    )
    assert.exists(description)
    description.requestDescription('hover')
    description.leaveDescription()
    expect(vi.getTimerCount()).toBe(1)

    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})
