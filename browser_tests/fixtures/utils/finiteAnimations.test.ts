import { describe, expect, it } from 'vitest'

import { finishFiniteAnimations } from '@e2e/fixtures/utils/finiteAnimations'

const FRAMES = [{ opacity: 0 }, { opacity: 1 }]

function startPaused(element: Element): Animation {
  const animation = element.animate(FRAMES, { duration: 20 })
  animation.pause()
  return animation
}

describe('finishFiniteAnimations', () => {
  it.for([
    {
      name: 'waits for a running finite animation',
      start: (element: Element) => element.animate(FRAMES, { duration: 20 }),
      playStateAfterWait: 'finished'
    },
    {
      name: 'does not wait for a paused animation',
      start: startPaused,
      playStateAfterWait: 'paused'
    },
    {
      name: 'does not wait for an infinite animation',
      start: (element: Element) =>
        element.animate(FRAMES, { duration: 20, iterations: Infinity }),
      playStateAfterWait: 'running'
    }
  ])('$name', async ({ start, playStateAfterWait }) => {
    const element = document.createElement('div')
    const animation = start(element)

    await finishFiniteAnimations(element)

    expect(animation.playState).toBe(playStateAfterWait)
  })
})
