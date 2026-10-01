import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBackgroundRemoval } from './useBackgroundRemoval'

vi.mock(import('../lib/workshop/background-removal/render-cutout'), () => ({
  renderCutout: vi.fn(() => Promise.resolve('blob:cutout'))
}))

let scope: ReturnType<typeof effectScope>

beforeEach(() => {
  vi.useFakeTimers()
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

function start() {
  const cutout = scope.run(useBackgroundRemoval)
  if (!cutout) throw new Error('no scope')
  cutout.useExample()
  return cutout
}

describe('useBackgroundRemoval', () => {
  it('runs on the current setup and lands on the result', async () => {
    const cutout = start()
    cutout.update({ background: 'white', format: 'webp' })

    const run = cutout.removeBackground()
    expect(cutout.phase.value.kind).toBe('running')
    expect(cutout.canRun.value).toBe(false)
    await vi.runAllTimersAsync()
    await run

    expect(cutout.phase.value).toEqual({
      kind: 'done',
      result: {
        url: 'blob:cutout',
        background: 'white',
        format: 'webp',
        seed: 42
      }
    })
  })

  it('starts a new photo from the default setup with nothing to undo', () => {
    const cutout = start()
    cutout.update({ background: 'lilac' })
    expect(cutout.touched.value).toBe(true)

    cutout.useExample()

    expect(cutout.setup.value.background).toBe('transparent')
    expect(cutout.canUndo.value).toBe(false)
    expect(cutout.touched.value).toBe(false)
  })

  it('releases the result when it goes back to editing', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const cutout = start()
    const run = cutout.removeBackground()
    await vi.runAllTimersAsync()
    await run

    cutout.edit()

    expect(cutout.phase.value.kind).toBe('editing')
    expect(revoke).toHaveBeenCalledWith('blob:cutout')
  })
})
