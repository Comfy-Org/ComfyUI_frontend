import { describe, expect, it, vi } from 'vitest'

import type { SpriteSheetRender } from './mock-run'
import { runSpriteSheet, spriteSheetRequest } from './mock-run'

vi.mock(import('./render-sheet'), () => ({
  renderSpriteSheet: vi.fn(() => Promise.resolve(undefined)),
  renderStyleThumbnails: vi.fn(() => Promise.resolve(undefined))
}))

const request = spriteSheetRequest('/fox.png', {
  style: 'toon',
  motion: 'jump',
  frames: 12,
  seed: 42
})

describe('spriteSheetRequest', () => {
  it('sends the character, the setup and how to lay out the sheet', () => {
    expect(request).toEqual({
      imageUrl: '/fox.png',
      style: 'toon',
      motion: 'jump',
      frames: 12,
      columns: 4,
      frameSize: 256,
      background: 'transparent',
      seed: 42
    })
  })
})

describe('runSpriteSheet', () => {
  it.for([
    {
      name: 'answers with the drawn sheet, laid out four to a row',
      rendered: 'blob:sheet',
      expected: { url: 'blob:sheet', frames: 12, columns: 4, rows: 3 }
    },
    {
      name: 'answers with the character as one frame where it cannot draw',
      rendered: undefined,
      expected: { url: '/fox.png', frames: 1, columns: 1, rows: 1 }
    }
  ])('$name', async ({ rendered, expected }) => {
    vi.useFakeTimers()
    const render: SpriteSheetRender = () => Promise.resolve(rendered)

    const run = runSpriteSheet(request, new AbortController().signal, render)
    await vi.runAllTimersAsync()

    await expect(run).resolves.toEqual({
      ...expected,
      frameSize: 256,
      seed: 42
    })
  })

  it('releases a drawn sheet when the run is cancelled', async () => {
    vi.useFakeTimers()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const controller = new AbortController()

    const run = runSpriteSheet(request, controller.signal, () =>
      Promise.resolve('blob:sheet')
    )
    controller.abort()

    await expect(run).rejects.toBeDefined()
    await vi.runAllTimersAsync()
    expect(revoke).toHaveBeenCalledWith('blob:sheet')
  })
})
