import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope } from 'vue'

import { PAPARAZZI_EXAMPLE } from '../lib/workshop/paparazzi-me/mock-run'
import { renderPaparazziImage } from '../lib/workshop/paparazzi-me/render'
import { SCENE_PLACES } from '../lib/workshop/paparazzi-me/scenes'
import { DEFAULT_SETUP, nextSeed } from '../lib/workshop/paparazzi-me/setup'
import { usePaparazziMe } from './usePaparazziMe'

vi.mock(import('../lib/workshop/paparazzi-me/render'), () => ({
  renderPaparazziImage: vi.fn(() => Promise.resolve(undefined))
}))
vi.mock(import('../lib/workshop/image-size'), () => ({
  imageSize: vi.fn(() => Promise.resolve({ width: 900, height: 600 }))
}))

let scope: EffectScope

function start() {
  const paparazzi = scope.run(() => usePaparazziMe())
  if (!paparazzi) throw new Error('no scope')
  return paparazzi
}

async function settle(work: Promise<unknown> = Promise.resolve()) {
  await vi.runAllTimersAsync()
  await work
}

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(URL, 'createObjectURL').mockImplementation(
    (file) => `blob:${file instanceof File ? file.name : 'shot'}`
  )
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

describe('usePaparazziMe', () => {
  it('opens on the worked example: the star looked up, her first photo picked', () => {
    const paparazzi = start()
    expect(paparazzi.face.value).toBe(PAPARAZZI_EXAMPLE)
    expect(paparazzi.setup.value).toEqual(DEFAULT_SETUP)
    expect(paparazzi.candidates.value).toHaveLength(SCENE_PLACES.length)
    expect(paparazzi.scene.value).toMatchObject({
      kind: 'found',
      candidate: { place: SCENE_PLACES[0] }
    })
    expect(paparazzi.canRun.value).toBe(true)
  })

  it('looks a new star up, and finds the earlier one again on undo', async () => {
    const paparazzi = start()
    paparazzi.change({ celebrity: 'Orion' }, 'celebrity')
    paparazzi.change({ celebrity: 'Orion Vale' }, 'celebrity')
    expect(paparazzi.search.value.kind).toBe('idle')
    expect(paparazzi.scene.value).toBeUndefined()

    const search = paparazzi.findScenes()
    expect(paparazzi.search.value.kind).toBe('searching')
    await settle(search)
    paparazzi.pickScene('orion-vale/yacht')
    expect(paparazzi.scene.value).toMatchObject({
      candidate: { token: 'orion-vale/yacht' }
    })

    paparazzi.undo()
    paparazzi.undo()
    expect(paparazzi.setup.value).toEqual(DEFAULT_SETUP)
    expect(paparazzi.search.value.kind).toBe('found')
    paparazzi.redo()
    expect(paparazzi.search.value).toMatchObject({
      kind: 'found',
      query: 'orion vale'
    })
  })

  it.for([
    { name: 'a one-letter star', celebrity: 'N', own: false, canRun: false },
    { name: 'a star', celebrity: 'Nova Reyes', own: false, canRun: true },
    {
      name: 'its own scene and no star',
      celebrity: '',
      own: true,
      canRun: true
    }
  ])('can run with $name: $canRun', async ({ celebrity, own, canRun }) => {
    const paparazzi = start()
    paparazzi.change({ celebrity })
    if (own) await paparazzi.useSceneFile(photo('party.jpg'))
    expect(paparazzi.canRun.value).toBe(canRun)
    expect(paparazzi.missingStar.value).toBe(!canRun)
  })

  it('runs the worked example to its prepared photo', async () => {
    const paparazzi = start()
    const run = paparazzi.snap()
    expect(paparazzi.phase.value.kind).toBe('running')
    await settle(run)

    expect(paparazzi.phase.value).toEqual({
      kind: 'done',
      result: {
        url: '/images/apps/paparazzi-me/example-result.jpg',
        seed: DEFAULT_SETUP.seed
      }
    })
  })

  it('looks the star up before running when nobody searched yet', async () => {
    const paparazzi = start()
    paparazzi.change({ celebrity: 'Sable Quinn' })

    await settle(paparazzi.snap())

    expect(paparazzi.search.value.kind).toBe('found')
    expect(vi.mocked(renderPaparazziImage)).toHaveBeenLastCalledWith(
      SCENE_PLACES[0],
      PAPARAZZI_EXAMPLE.url,
      PAPARAZZI_EXAMPLE.crop,
      '2K'
    )
    expect(paparazzi.phase.value).toMatchObject({
      kind: 'done',
      result: { url: SCENE_PLACES[0].url }
    })
  })

  it('puts an uploaded face in an uploaded scene', async () => {
    const paparazzi = start()
    await paparazzi.useFaceFile(photo('me.jpg'))
    await paparazzi.useSceneFile(photo('party.jpg'))
    expect(paparazzi.scene.value).toMatchObject({ kind: 'own' })

    await settle(paparazzi.snap())

    expect(vi.mocked(renderPaparazziImage)).toHaveBeenLastCalledWith(
      { url: 'blob:party.jpg', you: 0.3 },
      'blob:me.jpg',
      expect.anything(),
      '2K'
    )
    paparazzi.pickScene('nova-reyes/gym')
    expect(paparazzi.scene.value).toMatchObject({ kind: 'found' })
    paparazzi.pickOwnScene()
    expect(paparazzi.scene.value).toMatchObject({ kind: 'own' })
  })

  it('takes another shot on the next seed', async () => {
    const paparazzi = start()
    await settle(paparazzi.snap())

    paparazzi.retry()
    await settle()

    expect(paparazzi.phase.value).toMatchObject({
      kind: 'done',
      result: { seed: nextSeed(DEFAULT_SETUP.seed) }
    })
  })

  it('goes back to editing when cancelled or when the face changes', async () => {
    const paparazzi = start()
    void paparazzi.snap()
    paparazzi.cancel()
    await settle()
    expect(paparazzi.phase.value.kind).toBe('editing')

    await settle(paparazzi.snap())
    await paparazzi.useFaceFile(photo('me.jpg'))
    expect(paparazzi.phase.value.kind).toBe('editing')
    expect(paparazzi.face.value.name).toBe('me.jpg')
  })
})
