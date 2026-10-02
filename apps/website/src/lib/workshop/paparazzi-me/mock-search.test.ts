import { describe, expect, it, vi } from 'vitest'

import { lookUp, placeOfToken, searchScenes } from './mock-search'
import { SCENE_PLACES } from './scenes'

describe('lookUp', () => {
  it('finds every sample place for any name, the red carpet first', () => {
    const { candidates } = lookUp('  Orion Vale ')

    expect(candidates.map(({ place }) => place)).toEqual(SCENE_PLACES)
    expect(candidates[0].token).toBe('orion-vale/red-carpet')
    expect(candidates.map(({ token }) => placeOfToken(token))).toEqual(
      SCENE_PLACES
    )
  })
})

describe('searchScenes', () => {
  it('answers after a moment, or rejects when cancelled', async () => {
    vi.useFakeTimers()
    const answered = searchScenes('Nova Reyes', new AbortController().signal)
    await vi.runAllTimersAsync()
    await expect(answered).resolves.toEqual(lookUp('Nova Reyes'))

    const controller = new AbortController()
    const cancelled = searchScenes('Nova Reyes', controller.signal)
    controller.abort()
    await expect(cancelled).rejects.toBeDefined()
  })
})
