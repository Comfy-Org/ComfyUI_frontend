import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope } from 'vue'

import { PAPARAZZI_EXAMPLE } from '../lib/workshop/paparazzi-me/mock-run'
import { renderPaparazziImage } from '../lib/workshop/paparazzi-me/render'
import { DEFAULT_SETUP, nextSeed } from '../lib/workshop/paparazzi-me/setup'
import { usePaparazziMe } from './usePaparazziMe'

vi.mock(import('../lib/workshop/paparazzi-me/render'), () => ({
  renderPaparazziImage: vi.fn(() => Promise.resolve(undefined))
}))

let scope: EffectScope

function start() {
  const paparazzi = scope.run(() => usePaparazziMe())
  if (!paparazzi) throw new Error('no scope')
  return paparazzi
}

async function finish(paparazzi: ReturnType<typeof usePaparazziMe>) {
  const run = paparazzi.snap()
  await vi.runAllTimersAsync()
  await run
}

beforeEach(() => {
  vi.useFakeTimers()
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

describe('usePaparazziMe', () => {
  it('opens on the worked example, ready to run', () => {
    const paparazzi = start()
    expect(paparazzi.face.value).toBe(PAPARAZZI_EXAMPLE)
    expect(paparazzi.setup.value).toEqual(DEFAULT_SETUP)
    expect(paparazzi.canRun.value).toBe(true)
    expect(paparazzi.touched.value).toBe(false)
  })

  it('undoes a run of typing as one step, and a scene pick as another', () => {
    const paparazzi = start()
    paparazzi.change({ celebrity: 'O' }, 'celebrity')
    paparazzi.change({ celebrity: 'Or' }, 'celebrity')
    paparazzi.change({ sceneOverride: 'a rooftop' }, 'override')
    paparazzi.pickScene('cafe')

    expect(paparazzi.setup.value).toMatchObject({
      celebrity: 'Or',
      scene: 'cafe',
      sceneOverride: ''
    })
    paparazzi.undo()
    expect(paparazzi.setup.value.sceneOverride).toBe('a rooftop')
    paparazzi.undo()
    paparazzi.undo()
    expect(paparazzi.setup.value).toEqual(DEFAULT_SETUP)
    expect(paparazzi.canUndo.value).toBe(false)
    paparazzi.redo()
    expect(paparazzi.setup.value.celebrity).toBe('Or')
    expect(paparazzi.touched.value).toBe(true)
  })

  it.for([
    { name: 'without a face', act: 'remove', canRun: false },
    { name: 'with a one-letter star', act: 'short', canRun: false },
    { name: 'with the face back', act: 'example', canRun: true }
  ] as const)('can run $name: $canRun', ({ act, canRun }) => {
    const paparazzi = start()
    paparazzi.removeFace()
    if (act === 'short') {
      paparazzi.useExample()
      paparazzi.change({ celebrity: 'N' })
    }
    if (act === 'example') paparazzi.useExample()
    expect(paparazzi.canRun.value).toBe(canRun)
  })

  it('sends the face, the star and the scene, then shows the result', async () => {
    const paparazzi = start()
    paparazzi.change({ celebrity: ' Sable Quinn ' })
    paparazzi.pickScene('airport')

    const run = paparazzi.snap()
    expect(paparazzi.phase.value.kind).toBe('running')
    await vi.runAllTimersAsync()
    await run

    expect(vi.mocked(renderPaparazziImage)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        faceUrl: PAPARAZZI_EXAMPLE.url,
        celebrity: 'Sable Quinn',
        scene: 'airport'
      }),
      PAPARAZZI_EXAMPLE.crop
    )
    expect(paparazzi.phase.value).toEqual({
      kind: 'done',
      result: {
        url: '/images/apps/paparazzi-me/example-result.jpg',
        seed: DEFAULT_SETUP.seed
      }
    })
  })

  it('takes another shot on the next seed', async () => {
    const paparazzi = start()
    await finish(paparazzi)

    paparazzi.retry()
    await vi.runAllTimersAsync()

    expect(paparazzi.setup.value.seed).toBe(nextSeed(DEFAULT_SETUP.seed))
    expect(paparazzi.phase.value).toMatchObject({
      kind: 'done',
      result: { seed: nextSeed(DEFAULT_SETUP.seed) }
    })
  })

  it('goes back to editing when cancelled or when the face changes', async () => {
    const paparazzi = start()
    void paparazzi.snap()
    paparazzi.cancel()
    await vi.runAllTimersAsync()
    expect(paparazzi.phase.value.kind).toBe('editing')

    await finish(paparazzi)
    paparazzi.removeFace()
    expect(paparazzi.phase.value.kind).toBe('editing')
    expect(paparazzi.face.value).toBeUndefined()
  })
})
