import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { useSkillMenuDescription } from './useSkillMenuDescription'

function hoverPortrait() {
  const scope = effectScope()
  const description = scope.run(() =>
    useSkillMenuDescription(() => ({ name: 'portrait', description: '' }))
  )
  assert.exists(description)
  description.requestDescription('hover')
  return { scope, description }
}

describe('useSkillMenuDescription', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('describes the requested skill only after the show delay', async () => {
    const { description } = hoverPortrait()
    await nextTick()
    vi.advanceTimersByTime(249)
    expect(description.describedSkill.value).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(description.describedSkill.value?.name).toBe('portrait')
  })

  it.for<{
    pointer: string
    move: (description: ReturnType<typeof useSkillMenuDescription>) => void
    described: string | undefined
  }>([
    {
      pointer: 'leaves',
      move: (description) => description.leaveDescription(),
      described: undefined
    },
    {
      pointer: 'leaves and returns',
      move: (description) => {
        description.leaveDescription()
        description.keepDescriptionOpen()
      },
      described: 'portrait'
    }
  ])(
    'describes $described after the close delay when the pointer $pointer',
    async ({ move, described }) => {
      const { description } = hoverPortrait()
      await nextTick()
      vi.advanceTimersByTime(250)
      move(description)
      vi.advanceTimersByTime(150)
      expect(description.describedSkill.value?.name).toBe(described)
    }
  )

  it('leaves no pending hover-close timer after its scope is disposed', () => {
    const { scope, description } = hoverPortrait()
    description.leaveDescription()
    expect(vi.getTimerCount()).toBe(1)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})
