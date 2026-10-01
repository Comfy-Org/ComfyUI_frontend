import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope } from 'vue'

import { renderSpriteSheet } from '../lib/workshop/sprite-sheet/render-sheet'
import { useSpriteSheet } from './useSpriteSheet'

vi.mock(import('../lib/workshop/sprite-sheet/render-sheet'), () => ({
  renderSpriteSheet: vi.fn((_url: string, _setup: unknown, plain?: boolean) =>
    Promise.resolve(plain ? 'blob:plain' : 'blob:sheet')
  ),
  renderStyleThumbnails: vi.fn(() => Promise.resolve(undefined))
}))

let scope: EffectScope

function start() {
  const sprite = scope.run(() => useSpriteSheet())
  if (!sprite) throw new Error('no scope')
  sprite.useExample()
  return sprite
}

async function finish(run: Promise<void>) {
  await vi.advanceTimersByTimeAsync(3000)
  await run
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  vi.mocked(renderSpriteSheet).mockClear()
})

describe('useSpriteSheet', () => {
  it('opens the example as a Pixel walk of 8 frames, nothing to undo', () => {
    const sprite = start()
    expect(sprite.image.value?.name).toBe('fox-explorer.png')
    expect(sprite.setup.value).toMatchObject({
      style: 'pixel',
      motion: 'walk',
      frames: 8
    })
    expect(sprite.canUndo.value).toBe(false)
    expect(sprite.canRun.value).toBe(true)
  })

  it('undoes and redoes setup changes, a run of seed edits as one step', () => {
    const sprite = start()
    sprite.change({ style: 'toon' })
    sprite.change({ seed: 5 }, 'seed')
    sprite.change({ seed: 56 }, 'seed')

    sprite.undo()
    expect(sprite.setup.value).toMatchObject({ style: 'toon', seed: 1234 })
    sprite.undo()
    expect(sprite.setup.value.style).toBe('pixel')
    expect(sprite.canUndo.value).toBe(false)

    sprite.redo()
    sprite.redo()
    expect(sprite.setup.value).toMatchObject({ style: 'toon', seed: 56 })
    expect(sprite.canRedo.value).toBe(false)
  })

  it('makes the sheet, then the plain sheet to compare it with', async () => {
    const sprite = start()
    sprite.change({ motion: 'jump', frames: 12 })

    await finish(sprite.generate())

    expect(sprite.phase.value).toMatchObject({
      kind: 'done',
      result: { url: 'blob:sheet', frames: 12, columns: 4, rows: 3 }
    })
    expect(sprite.playback.total.value).toBe(12)
    expect(sprite.source.value).toBe('blob:plain')
  })

  it('tries again on the next seed, which undo can take back', async () => {
    const sprite = start()
    await finish(sprite.generate())

    sprite.again()
    await vi.advanceTimersByTimeAsync(3000)

    expect(sprite.setup.value.seed).toBe(1235)
    expect(renderSpriteSheet).toHaveBeenLastCalledWith(
      '/images/apps/sprite-sheet/example.png',
      expect.objectContaining({ seed: 1235 }),
      true
    )
    sprite.edit()
    sprite.undo()
    expect(sprite.setup.value.seed).toBe(1234)
  })

  it('goes back to editing, sheet and comparison released', async () => {
    const sprite = start()
    await finish(sprite.generate())
    sprite.compare.value = true

    sprite.edit()

    expect(sprite.phase.value.kind).toBe('editing')
    expect(sprite.compare.value).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sheet')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:plain')
  })

  it('cancels a run without a result or a failure', async () => {
    const sprite = start()
    const run = sprite.generate()
    expect(sprite.phase.value.kind).toBe('running')

    sprite.cancel()
    await finish(run)

    expect(sprite.phase.value.kind).toBe('editing')
  })
})
