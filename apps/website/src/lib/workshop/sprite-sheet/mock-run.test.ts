import { describe, expect, it, vi } from 'vitest'

import type { SpriteSheetProgress } from './contract'
import { spriteSheetRequest } from './contract'
import type { SpriteSheetRender } from './mock-run'
import { SPRITE_EXAMPLE, runSpriteSheet } from './mock-run'
import type { SpriteMotion, SpriteStyle } from './options'

vi.mock(import('./render-sheet'), () => ({
  renderSpriteSheet: vi.fn(() => Promise.resolve(undefined)),
  renderStyleThumbnails: vi.fn(() => Promise.resolve(undefined))
}))

const request = spriteSheetRequest('/fox.png', {
  description: 'dancing',
  style: 'toon',
  motion: 'jump',
  seed: 42
})

describe('runSpriteSheet', () => {
  it.for([
    {
      name: 'answers with the drawn sheet, eight frames four to a row',
      rendered: 'blob:sheet',
      expected: { url: 'blob:sheet', frames: 8, columns: 4, rows: 2 }
    },
    {
      name: 'answers with the character as one frame where it cannot draw',
      rendered: undefined,
      expected: { url: '/fox.png', frames: 1, columns: 1, rows: 1 }
    }
  ])('$name', async ({ rendered, expected }) => {
    vi.useFakeTimers()
    const render: SpriteSheetRender = () => Promise.resolve(rendered)

    const run = runSpriteSheet(request, new AbortController().signal, {
      render
    })
    await vi.runAllTimersAsync()

    await expect(run).resolves.toEqual({ ...expected, seed: 42 })
  })

  it.for<{
    image: string
    style: SpriteStyle
    motion: SpriteMotion
    url: string
  }>([
    {
      image: SPRITE_EXAMPLE.url,
      style: 'pixel',
      motion: 'walk',
      url: '/images/apps/sprite-sheet/explorer-walk-pixel.webp'
    },
    {
      image: SPRITE_EXAMPLE.url,
      style: '3d',
      motion: 'walk',
      url: '/images/apps/sprite-sheet/explorer-walk-3d.webp'
    },
    {
      image: SPRITE_EXAMPLE.url,
      style: 'toon',
      motion: 'jump',
      url: SPRITE_EXAMPLE.url
    },
    { image: '/upload.png', style: 'toon', motion: 'walk', url: '/upload.png' }
  ])(
    'answers $image as $style $motion with $url',
    async ({ image, style, motion, url }) => {
      vi.useFakeTimers()
      const exampleRequest = spriteSheetRequest(image, {
        description: '',
        style,
        motion,
        seed: 1
      })

      const run = runSpriteSheet(exampleRequest, new AbortController().signal)
      await vi.runAllTimersAsync()

      await expect(run).resolves.toMatchObject({ url })
    }
  )

  it('reports the queue, then the run counting up', async () => {
    vi.useFakeTimers()
    const seen: SpriteSheetProgress[] = []

    const run = runSpriteSheet(request, new AbortController().signal, {
      onProgress: (progress) => seen.push(progress),
      render: () => Promise.resolve('blob:sheet')
    })
    await vi.runAllTimersAsync()
    await run

    expect(seen[0]).toEqual({ stage: 'queued' })
    expect(seen[1]).toEqual({ stage: 'running', percent: 0 })
    expect(seen.at(-1)).toEqual({ stage: 'running', percent: 90 })
  })

  it('releases a drawn sheet when the run is cancelled', async () => {
    vi.useFakeTimers()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const controller = new AbortController()

    const run = runSpriteSheet(request, controller.signal, {
      render: () => Promise.resolve('blob:sheet')
    })
    controller.abort()

    await expect(run).rejects.toBeDefined()
    await vi.runAllTimersAsync()
    expect(revoke).toHaveBeenCalledWith('blob:sheet')
  })
})
