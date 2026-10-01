import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope } from 'vue'

import { renderRelitImage } from '../lib/workshop/relight/render-image'
import { useRelight } from './useRelight'

vi.mock(import('../lib/workshop/relight/render-image'), () => ({
  renderRelitImage: vi.fn(() => Promise.resolve(undefined))
}))

let scope: EffectScope

function start() {
  const relight = scope.run(() => useRelight('en'))
  if (!relight) throw new Error('no scope')
  relight.useExample()
  return relight
}

const names = (relight: ReturnType<typeof useRelight>) =>
  relight.lights.value.map(({ name }) => name)

async function finish(relight: ReturnType<typeof useRelight>) {
  const run = relight.relight()
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

describe('useRelight', () => {
  it('opens the example on Sunset, its key light kept inside the Subject mask', () => {
    const relight = start()
    expect(relight.setup.value.mood).toBe('sunset')
    expect(names(relight)).toEqual(['Warm key', 'Cool fill'])
    expect(relight.setup.value.masks.map(({ name }) => name)).toEqual([
      'Subject'
    ])
    expect(relight.lights.value.map(({ mask }) => mask)).toEqual([
      'mask-1',
      undefined
    ])
    expect(relight.canRun.value).toBe(true)
  })

  it('adds point and directional lights up to four', () => {
    const relight = start()
    relight.addLight('directional')
    relight.addLight()
    expect(relight.full.value).toBe(true)

    relight.addLight()
    expect(
      relight.lights.value.map(({ name, kind }) => `${name} ${kind}`)
    ).toEqual([
      'Warm key directional',
      'Cool fill point',
      'Light 3 directional',
      'Light 4 point'
    ])
  })

  it('duplicates a light next to it and selects the copy', () => {
    const relight = start()
    relight.duplicateLight('sunset-1')

    expect(names(relight)).toEqual(['Warm key', 'Warm key copy', 'Cool fill'])
    const [source, copy] = relight.lights.value
    expect(relight.selected.value).toBe(copy.id)
    expect(copy.x).toBeCloseTo(source.x + 0.05)
    expect(copy.color).toBe(source.color)
  })

  it('undoes and redoes light, preset, scene and generation changes', () => {
    const relight = start()
    relight.updateLight('sunset-1', { color: '#ff5fd2' })
    relight.pickMood('window')
    relight.updateScene({ reflections: 80 })
    relight.updateGeneration({ area: 'masked' })
    expect(names(relight)).toEqual(['Window'])

    relight.undo()
    expect(relight.setup.value.generation.area).toBe('whole')
    relight.undo()
    expect(relight.setup.value.scene.reflections).toBe(20)
    relight.undo()
    expect(relight.setup.value.mood).toBe('sunset')
    expect(relight.lights.value[0].color).toBe('#ff5fd2')
    relight.undo()
    expect(relight.lights.value[0].color).toBe('#ffb35c')
    expect(relight.canUndo.value).toBe(false)

    relight.redo()
    relight.redo()
    expect(relight.setup.value.mood).toBe('window')
  })

  it.for([
    { field: 'intensity', key: 'intensity:sunset-1', start: 80 },
    { field: 'direction', key: 'direction:sunset-1', start: 34 },
    { field: 'elevation', key: 'elevation:sunset-1', start: 35 }
  ] as const)(
    'undoes one $field drag as a single step',
    ({ field, key, start: before }) => {
      const relight = start()
      for (const value of [10, 20, 30])
        relight.updateLight('sunset-1', { [field]: value }, key)

      relight.undo()
      expect(relight.lights.value[0][field]).toBe(before)
    }
  )

  it('creates a mask from a subject for the selected light, undoably', () => {
    const relight = start()
    relight.selected.value = 'sunset-2'

    relight.addMask('  red jacket ')

    expect(relight.setup.value.masks.map(({ name }) => name)).toEqual([
      'Subject',
      'red jacket'
    ])
    expect(relight.lights.value[1].mask).toBe('mask-2')
    relight.undo()
    expect(relight.setup.value.masks).toHaveLength(1)
    expect(relight.lights.value[1].mask).toBeUndefined()
  })

  it('ignores a blank subject', () => {
    const relight = start()
    relight.addMask('   ')
    expect(relight.setup.value.masks).toHaveLength(1)
    expect(relight.canUndo.value).toBe(false)
  })

  it('lights the whole image again when its mask is deleted', () => {
    const relight = start()
    relight.removeMask('mask-1')
    expect(relight.setup.value.masks).toEqual([])
    expect(relight.lights.value[0].mask).toBeUndefined()
  })

  it('applies a shadow look to every light as one undo step', () => {
    const relight = start()
    expect(relight.shadows.value).toBe('soft')

    relight.applyShadowStyle('none')

    expect(relight.shadows.value).toBe('none')
    expect(relight.lights.value.every(({ shadows }) => !shadows)).toBe(true)
    relight.undo()
    expect(relight.shadows.value).toBe('soft')
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
      result: { url: '/images/apps/relight/example-relit.jpg', seed: 1234 }
    })
    relight.edit()
    expect(relight.phase.value.kind).toBe('editing')
    expect(names(relight)).toEqual(['Warm key', 'Cool fill'])
  })

  it('shows the rendered relight and releases it when editing again', async () => {
    vi.mocked(renderRelitImage).mockResolvedValue('blob:relit')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const relight = start()

    await finish(relight)
    expect(relight.phase.value).toMatchObject({
      kind: 'done',
      result: { url: 'blob:relit' }
    })
    expect(vi.mocked(renderRelitImage).mock.calls[0][0]).toMatchObject({
      imageUrl: '/images/apps/relight/example.jpg',
      masks: [{ id: 'mask-1', name: 'Subject' }],
      generation: { seed: 1234, strength: 50, area: 'whole' }
    })

    relight.edit()
    expect(revoke).toHaveBeenCalledWith('blob:relit')
  })

  it('cancels a run without a result', async () => {
    const relight = start()
    const run = relight.relight()

    relight.cancel()
    await vi.runAllTimersAsync()
    await run

    expect(relight.phase.value.kind).toBe('editing')
  })

  it.for([
    { decodes: true, expected: 'photo.png' },
    { decodes: false, expected: 'portrait.jpg' }
  ])(
    'swaps in an uploaded photo only when it decodes (decodes: $decodes)',
    async ({ decodes, expected }) => {
      vi.stubGlobal(
        'Image',
        class {
          naturalWidth = 800
          naturalHeight = 600
          onload?: () => void
          onerror?: () => void
          set src(_url: string) {
            queueMicrotask(() => (decodes ? this.onload?.() : this.onerror?.()))
          }
        }
      )
      const relight = start()

      await relight.useFile(new File(['x'], 'photo.png', { type: 'image/png' }))

      expect(relight.image.value?.name).toBe(expected)
    }
  )

  it('starts an uploaded photo on Studio with no masks', async () => {
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 800
        naturalHeight = 600
        onload?: () => void
        set src(_url: string) {
          queueMicrotask(() => this.onload?.())
        }
      }
    )
    const relight = start()

    await relight.useFile(new File(['x'], 'photo.png', { type: 'image/png' }))

    expect(relight.setup.value.mood).toBe('studio')
    expect(relight.setup.value.masks).toEqual([])
  })
})
