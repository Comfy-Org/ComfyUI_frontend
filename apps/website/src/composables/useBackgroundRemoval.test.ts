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
    cutout.update({
      background: { kind: 'color', color: '#ffffff' },
      format: 'webp'
    })

    const run = cutout.removeBackground()
    expect(cutout.phase.value.kind).toBe('running')
    expect(cutout.canRun.value).toBe(false)
    await vi.runAllTimersAsync()
    await run

    expect(cutout.phase.value).toEqual({
      kind: 'done',
      result: {
        url: 'blob:cutout',
        mode: 'remove',
        format: 'webp',
        transparent: false
      }
    })
  })

  it('starts a new photo from the default setup with nothing to undo', () => {
    const cutout = start()
    cutout.update({ mode: 'adjust' })
    expect(cutout.touched.value).toBe(true)

    cutout.useExample()

    expect(cutout.setup.value.mode).toBe('remove')
    expect(cutout.canUndo.value).toBe(false)
    expect(cutout.touched.value).toBe(false)
  })

  it('waits for a description or a reference before it replaces', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:reference')
    const cutout = start()
    cutout.update({ mode: 'replace' })
    expect(cutout.missing.value).toBe('replace')
    expect(cutout.canRun.value).toBe(false)

    cutout.setReference(new File(['x'], 'wall.jpg', { type: 'image/jpeg' }))

    expect(cutout.setup.value.replace.referenceUrl).toBe('blob:reference')
    expect(cutout.canRun.value).toBe(true)
  })

  it('releases the reference pictures with the photo', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:reference')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const cutout = start()
    cutout.setReference(new File(['x'], 'wall.jpg', { type: 'image/jpeg' }))

    cutout.useExample()

    expect(revoke).toHaveBeenCalledWith('blob:reference')
    expect(cutout.setup.value.replace.referenceUrl).toBeUndefined()
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
