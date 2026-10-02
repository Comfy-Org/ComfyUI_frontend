import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope } from 'vue'

import { useVirtualTryOn } from './useVirtualTryOn'

vi.mock(import('../lib/workshop/virtual-try-on/render-image'), () => ({
  renderTryOn: vi.fn(() => Promise.resolve(undefined))
}))

let scope: EffectScope

function start() {
  const tryOn = scope.run(() => useVirtualTryOn('en'))
  if (!tryOn) throw new Error('no scope')
  return tryOn
}

const shirt = () => new File(['x'], 'shirt.png', { type: 'image/png' })

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:shirt')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

describe('useVirtualTryOn', () => {
  it('opens on the example person in the Breton tee, ready to run', () => {
    const tryOn = start()
    expect(tryOn.person.value.name).toBe('motel-balcony.jpg')
    expect(tryOn.garment.value?.name).toBe('Breton tee')
    expect(tryOn.setup.value.fit).toBe('regular')
    expect(tryOn.canRun.value).toBe(true)
    expect(tryOn.canUndo.value).toBe(false)
  })

  it('undoes and redoes garment, fit and seed changes, a typed seed as one step', () => {
    const tryOn = start()
    tryOn.pickGarment('flannel')
    tryOn.setFit('slim')
    tryOn.setSeed(1)
    tryOn.setSeed(12)

    tryOn.undo()
    expect(tryOn.setup.value).toMatchObject({ fit: 'slim', seed: 7 })
    tryOn.undo()
    expect(tryOn.setup.value.fit).toBe('regular')
    expect(tryOn.garment.value?.id).toBe('flannel')
    tryOn.redo()
    tryOn.redo()
    expect(tryOn.setup.value).toMatchObject({ fit: 'slim', seed: 12 })
    expect(tryOn.canRedo.value).toBe(false)
  })

  it('ignores picking what is already picked', () => {
    const tryOn = start()
    tryOn.pickGarment('breton')
    tryOn.setFit('regular')
    expect(tryOn.canUndo.value).toBe(false)
  })

  it('cannot run without a garment, and adds an uploaded one beside the examples', () => {
    const tryOn = start()
    tryOn.removeGarment()
    expect(tryOn.canRun.value).toBe(false)

    tryOn.useGarmentFile(shirt())
    expect(tryOn.garment.value).toMatchObject({
      url: 'blob:shirt',
      name: 'shirt.png'
    })
    expect(tryOn.garments.value.map(({ name }) => name)).toEqual([
      'Breton tee',
      'Flannel shirt',
      'Sage knit',
      'shirt.png'
    ])
    expect(tryOn.canRun.value).toBe(true)
  })

  it('runs a try-on, lands on the compare view, then goes back to editing', async () => {
    const tryOn = start()
    tryOn.setFit('relaxed')
    tryOn.view.value = 'result'

    const run = tryOn.tryOn()
    expect(tryOn.phase.value.kind).toBe('running')
    expect(tryOn.canRun.value).toBe(false)
    await vi.runAllTimersAsync()
    await run

    expect(tryOn.phase.value).toMatchObject({
      kind: 'done',
      result: { url: '/images/apps/virtual-try-on/result-breton.jpg', seed: 7 }
    })
    expect(tryOn.view.value).toBe('compare')
    tryOn.edit()
    expect(tryOn.phase.value.kind).toBe('editing')
    expect(tryOn.setup.value.fit).toBe('relaxed')
  })

  it('cancels a run without a result', async () => {
    const tryOn = start()
    const run = tryOn.tryOn()

    tryOn.cancel()
    await vi.runAllTimersAsync()
    await run

    expect(tryOn.phase.value.kind).toBe('editing')
  })

  it('opens one tray at a time and closes it when tapped again', () => {
    const tryOn = start()
    tryOn.toggleTray('fit')
    tryOn.toggleTray('garment')
    expect(tryOn.tray.value).toBe('garment')
    tryOn.toggleTray('garment')
    expect(tryOn.tray.value).toBeUndefined()
  })
})
