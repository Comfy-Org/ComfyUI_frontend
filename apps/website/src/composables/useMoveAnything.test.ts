import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope } from 'vue'

import { moveRect } from '../lib/workshop/move-anything/arrange'
import { useMoveAnything } from './useMoveAnything'

let scope: EffectScope

function start() {
  const move = scope.run(() => useMoveAnything('en'))
  if (!move) throw new Error('no scope')
  move.useExample()
  return move
}

const KITTEN = { x: 0.2, y: 0.5 }

async function pick(
  move: ReturnType<typeof useMoveAnything>,
  at: { x: number; y: number }
) {
  move.smartSelect(at)
  await vi.advanceTimersByTimeAsync(600)
  const object = move.objects.value.at(-1)
  if (!object) throw new Error('nothing detected')
  return object
}

async function shiftKitten(move: ReturnType<typeof useMoveAnything>) {
  const kitten = await pick(move, KITTEN)
  move.checkpoint()
  move.place(kitten.id, moveRect(kitten.to, 0.2, 0))
}

beforeEach(() => {
  vi.useFakeTimers()
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

describe('useMoveAnything', () => {
  it('opens the example with Smart select and nothing selected yet', () => {
    const move = start()
    expect(move.tool.value).toBe('smart')
    expect(move.objects.value).toEqual([])
    expect(move.canGenerate.value).toBe(false)
  })

  it('detects the kitten under a click, outlines and names it, then switches to Move', async () => {
    const move = start()
    move.smartSelect(KITTEN)
    expect(move.detecting.value).toEqual(KITTEN)

    const kitten = await pick(move, KITTEN)

    expect(move.detecting.value).toBeUndefined()
    expect(move.objects.value).toHaveLength(1)
    expect(kitten).toMatchObject({
      label: 'Orange kitten',
      mask: { path: expect.stringMatching(/^M.*Z$/) }
    })
    expect(kitten.from.x).toBeCloseTo(0)
    expect(kitten.from.h).toBeGreaterThan(0.6)
    expect(move.selected.value).toBe(kitten.id)
    expect(move.tool.value).toBe('move')
  })

  it('selects an already detected thing instead of adding it twice', async () => {
    const move = start()
    await pick(move, KITTEN)
    await pick(move, KITTEN)
    expect(move.objects.value).toHaveLength(1)
  })

  it.for([
    {
      name: 'snaps a box around a succulent to its outline',
      box: { x: 0.28, y: 0.53, w: 0.15, h: 0.25 },
      label: 'Succulent',
      snapped: true
    },
    {
      name: 'keeps a box over nothing known as a rounded box',
      box: { x: 0.7, y: 0.1, w: 0.2, h: 0.2 },
      label: 'Object 1',
      snapped: false
    }
  ])('$name', ({ box, label, snapped }) => {
    const move = start()
    move.boxSelect(box)
    const [object] = move.objects.value
    expect(object.label).toBe(label)
    expect(object.mask?.path).toMatch(snapped ? /C/ : /A/)
    if (!snapped) expect(object.from).toEqual(box)
  })

  it('renames a thing, and undoes it', async () => {
    const move = start()
    const kitten = await pick(move, KITTEN)

    move.rename(kitten.id, '  Ginger  ')
    expect(move.objects.value[0].label).toBe('Ginger')
    move.rename(kitten.id, '   ')
    expect(move.objects.value[0].label).toBe('Ginger')

    move.undo()
    expect(move.objects.value[0].label).toBe('Orange kitten')
  })

  it('undoes and redoes a move', async () => {
    const move = start()
    await shiftKitten(move)
    expect(move.moved.value).toHaveLength(1)

    move.undo()
    expect(move.moved.value).toHaveLength(0)
    move.redo()
    expect(move.moved.value).toHaveLength(1)
  })

  it('runs a move and lands on the result, then goes back to arranging', async () => {
    const move = start()
    await shiftKitten(move)

    const run = move.generate()
    expect(move.phase.value.kind).toBe('moving')
    await vi.runAllTimersAsync()
    await run

    expect(move.phase.value).toMatchObject({
      kind: 'done',
      result: { url: '/images/apps/move-anything/example-moved.jpg' }
    })
    move.edit()
    expect(move.phase.value.kind).toBe('arranging')
    expect(move.moved.value).toHaveLength(1)
  })

  it('cancels a run without a result', async () => {
    const move = start()
    await shiftKitten(move)
    const run = move.generate()

    move.cancel()
    await vi.runAllTimersAsync()
    await run

    expect(move.phase.value.kind).toBe('arranging')
  })

  it('caps a photo at four things', () => {
    const move = start()
    for (const x of [0.6, 0.7, 0.8, 0.9])
      move.boxSelect({ x, y: 0.05, w: 0.05, h: 0.05 })
    expect(move.full.value).toBe(true)

    move.boxSelect({ x: 0.6, y: 0.3, w: 0.1, h: 0.1 })
    expect(move.objects.value).toHaveLength(4)
  })
  it.for([
    { decodes: true, expected: 'photo.png' },
    { decodes: false, expected: 'kitten.jpg' }
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
      const move = start()

      await move.useFile(new File(['x'], 'photo.png', { type: 'image/png' }))

      expect(move.image.value?.name).toBe(expected)
      vi.unstubAllGlobals()
    }
  )
})
