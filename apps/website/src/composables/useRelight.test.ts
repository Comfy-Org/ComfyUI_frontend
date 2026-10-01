import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope } from 'vue'

import { useRelight } from './useRelight'

let scope: EffectScope

function start() {
  const relight = scope.run(() => useRelight('en'))
  if (!relight) throw new Error('no scope')
  relight.useExample()
  return relight
}

const names = (relight: ReturnType<typeof useRelight>) =>
  relight.lights.value.map(({ name }) => name)

beforeEach(() => {
  vi.useFakeTimers()
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

describe('useRelight', () => {
  it('opens the example on the Sunset mood with two lights, ready to run', () => {
    const relight = start()
    expect(relight.setup.value.mood).toBe('sunset')
    expect(names(relight)).toEqual(['Warm key', 'Cool fill'])
    expect(relight.canRun.value).toBe(true)
  })

  it('adds lights up to four', () => {
    const relight = start()
    relight.addLight()
    relight.addLight()
    expect(relight.full.value).toBe(true)

    relight.addLight()
    expect(names(relight)).toEqual([
      'Warm key',
      'Cool fill',
      'Light 3',
      'Light 4'
    ])
  })

  it('undoes and redoes light, mood and scene changes', () => {
    const relight = start()
    relight.updateLight('sunset-1', { color: 'magenta' })
    relight.pickMood('window')
    relight.updateScene({ shadows: false })
    expect(names(relight)).toEqual(['Window'])

    relight.undo()
    expect(relight.setup.value.scene.shadows).toBe(true)
    relight.undo()
    expect(relight.setup.value.mood).toBe('sunset')
    expect(relight.lights.value[0].color).toBe('magenta')
    relight.undo()
    expect(relight.lights.value[0].color).toBe('warm')
    expect(relight.canUndo.value).toBe(false)

    relight.redo()
    relight.redo()
    expect(relight.setup.value.mood).toBe('window')
  })

  it('undoes one slider drag as a single step', () => {
    const relight = start()
    for (const brightness of [70, 60, 50])
      relight.updateLight('sunset-1', { brightness }, 'brightness:sunset-1')

    relight.undo()
    expect(relight.lights.value[0].brightness).toBe(80)
  })

  it('cannot run with every light hidden', () => {
    const relight = start()
    relight.updateLight('sunset-1', { visible: false })
    relight.updateLight('sunset-2', { visible: false })
    expect(relight.canRun.value).toBe(false)
  })

  it('runs and lands on the relit example, then goes back to editing', async () => {
    const relight = start()
    const run = relight.relight()
    expect(relight.phase.value.kind).toBe('running')
    await vi.runAllTimersAsync()
    await run

    expect(relight.phase.value).toMatchObject({
      kind: 'done',
      result: { url: '/images/apps/relight/example-relit.jpg' }
    })
    relight.edit()
    expect(relight.phase.value.kind).toBe('editing')
    expect(names(relight)).toEqual(['Warm key', 'Cool fill'])
  })

  it('cancels a run without a result', async () => {
    const relight = start()
    const run = relight.relight()

    relight.cancel()
    await vi.runAllTimersAsync()
    await run

    expect(relight.phase.value.kind).toBe('editing')
  })
})
