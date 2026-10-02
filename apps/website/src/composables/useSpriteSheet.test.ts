import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope } from 'vue'

import { renderSpriteSheet } from '../lib/workshop/sprite-sheet/render-sheet'
import { useSpriteSheet } from './useSpriteSheet'

vi.mock(import('../lib/workshop/sprite-sheet/render-sheet'), () => ({
  renderSpriteSheet: vi.fn(() => Promise.resolve('blob:sheet')),
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
  it('opens the example as a Pixel walk with no animation text, nothing to undo', () => {
    const sprite = start()
    expect(sprite.image.value?.name).toBe('fox-explorer.png')
    expect(sprite.setup.value).toEqual({
      description: '',
      style: 'pixel',
      motion: 'walk',
      seed: 1234
    })
    expect(sprite.view.value).toBe('sheet')
    expect(sprite.canUndo.value).toBe(false)
    expect(sprite.canRun.value).toBe(true)
  })

  it('undoes and redoes setup changes, a run of edits to one field as one step', () => {
    const sprite = start()
    sprite.change({ style: 'toon' })
    sprite.change({ description: 'd' }, 'description')
    sprite.change({ description: 'dance' }, 'description')

    sprite.undo()
    expect(sprite.setup.value).toMatchObject({ style: 'toon', description: '' })
    sprite.undo()
    expect(sprite.setup.value.style).toBe('pixel')
    expect(sprite.canUndo.value).toBe(false)

    sprite.redo()
    sprite.redo()
    expect(sprite.setup.value).toMatchObject({
      style: 'toon',
      description: 'dance'
    })
    expect(sprite.canRedo.value).toBe(false)
  })

  it('reports the queue and the percentage, then shows eight frames four by two', async () => {
    const sprite = start()
    sprite.change({ motion: 'jump' })

    const run = sprite.generate()
    expect(sprite.phase.value).toMatchObject({
      kind: 'running',
      progress: { stage: 'queued' }
    })
    await vi.advanceTimersByTimeAsync(1000)
    expect(sprite.phase.value).toMatchObject({
      kind: 'running',
      progress: { stage: 'running' }
    })
    await finish(run)

    expect(sprite.phase.value).toMatchObject({
      kind: 'done',
      result: { url: 'blob:sheet', frames: 8, columns: 4, rows: 2 }
    })
    expect(sprite.playback.total.value).toBe(8)
  })

  it('tries again on the next seed, which undo can take back', async () => {
    const sprite = start()
    await finish(sprite.generate())

    sprite.again()
    await vi.advanceTimersByTimeAsync(3000)

    expect(sprite.setup.value.seed).toBe(1235)
    expect(renderSpriteSheet).toHaveBeenLastCalledWith(
      '/images/apps/sprite-sheet/example.png',
      expect.objectContaining({ seed: 1235 })
    )
    sprite.edit()
    sprite.undo()
    expect(sprite.setup.value.seed).toBe(1234)
  })

  it('goes back to editing and releases the sheet', async () => {
    const sprite = start()
    await finish(sprite.generate())

    sprite.edit()

    expect(sprite.phase.value.kind).toBe('editing')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sheet')
  })

  it('keeps the setup when the character is replaced', () => {
    const sprite = start()
    sprite.change({ description: 'dancing', style: '3d' })

    sprite.useExample()

    expect(sprite.setup.value).toMatchObject({
      description: 'dancing',
      style: '3d'
    })
  })

  it('opens the Preview stopped on a frame of the sheet', () => {
    const sprite = start()

    sprite.showFrame(5)

    expect(sprite.view.value).toBe('preview')
    expect(sprite.playback.frame.value).toBe(5)
    expect(sprite.playback.playing.value).toBe(false)
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
