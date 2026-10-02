import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope } from 'vue'

import { moveRect } from '../lib/workshop/move-anything/arrange'
import { useMoveAnything } from './useMoveAnything'

let scope: EffectScope

function open() {
  const move = scope.run(() => useMoveAnything('en'))
  if (!move) throw new Error('no scope')
  move.useExample()
  return move
}

async function start() {
  const move = open()
  await vi.advanceTimersByTimeAsync(700)
  return move
}

function stubImage(decodes = true) {
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
}

async function startUpload() {
  stubImage()
  const move = await start()
  await move.useFile(new File(['x'], 'photo.png', { type: 'image/png' }))
  return move
}

async function startWithoutFirstSucculent() {
  const move = await start()
  move.remove(move.objects.value[1].id)
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
  const [kitten] = move.objects.value
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
  it('detects the three things in the example in place, then switches to Move', async () => {
    const move = open()
    expect(move.detecting.value).toHaveLength(3)
    expect(move.objects.value).toEqual([])

    await vi.advanceTimersByTimeAsync(700)

    expect(move.detecting.value).toBeUndefined()
    expect(move.objects.value.map((object) => object.label)).toEqual([
      'Orange kitten',
      'Succulent',
      'Succulent'
    ])
    expect(move.objects.value[0].mask?.path).toMatch(/^M.*Z$/)
    expect(move.objects.value[0].from.h).toBeGreaterThan(0.6)
    expect(move.moved.value).toEqual([])
    expect(move.selected.value).toBeUndefined()
    expect(move.tool.value).toBe('move')
    expect(move.canUndo.value).toBe(false)
    move.undo()
    expect(move.objects.value).toHaveLength(3)
  })

  it('starts an uploaded photo with Smart select and nothing selected', async () => {
    const move = await startUpload()
    await vi.advanceTimersByTimeAsync(700)
    expect(move.tool.value).toBe('smart')
    expect(move.objects.value).toEqual([])
    expect(move.canGenerate.value).toBe(false)
  })

  it('outlines an unknown thing under a click in an uploaded photo, then switches to Move', async () => {
    const move = await startUpload()
    move.smartSelect(KITTEN)
    expect(move.detecting.value).toEqual([KITTEN])

    const object = await pick(move, KITTEN)

    expect(move.detecting.value).toBeUndefined()
    expect(object).toMatchObject({
      label: 'Object 1',
      mask: { path: expect.stringMatching(/^M.*Z$/) }
    })
    expect(move.selected.value).toBe(object.id)
    expect(move.tool.value).toBe('move')
  })

  it('re-detects a removed kitten under a click, and selects it instead of adding it twice', async () => {
    const move = await start()
    move.remove(move.objects.value[0].id)

    const kitten = await pick(move, KITTEN)
    expect(kitten.label).toBe('Orange kitten')
    await pick(move, KITTEN)
    expect(move.objects.value).toHaveLength(3)
    expect(move.selected.value).toBe(kitten.id)
  })

  it.for([
    {
      name: 'snaps a box around a succulent to its outline',
      box: { x: 0.28, y: 0.53, w: 0.15, h: 0.25 },
      label: 'Succulent',
      open: startWithoutFirstSucculent,
      snapped: true
    },
    {
      name: 'keeps a box over nothing known as a rounded box',
      box: { x: 0.7, y: 0.1, w: 0.2, h: 0.2 },
      label: 'Object 1',
      open: startUpload,
      snapped: false
    }
  ])('$name', async ({ box, label, open, snapped }) => {
    const move = await open()
    move.boxSelect(box)
    const object = move.objects.value.at(-1)
    expect(object?.label).toBe(label)
    expect(object?.mask?.path).toMatch(snapped ? /C/ : /A/)
    if (!snapped) expect(object?.from).toEqual(box)
  })

  it('renames a thing, and undoes it', async () => {
    const move = await start()
    const [kitten] = move.objects.value

    move.rename(kitten.id, '  Ginger  ')
    expect(move.objects.value[0].label).toBe('Ginger')
    move.rename(kitten.id, '   ')
    expect(move.objects.value[0].label).toBe('Ginger')

    move.undo()
    expect(move.objects.value[0].label).toBe('Orange kitten')
  })

  it('undoes and redoes a move', async () => {
    const move = await start()
    await shiftKitten(move)
    expect(move.moved.value).toHaveLength(1)

    move.undo()
    expect(move.moved.value).toHaveLength(0)
    move.redo()
    expect(move.moved.value).toHaveLength(1)
  })

  it('runs a move and lands on the result, then goes back to arranging', async () => {
    const move = await start()
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
    const move = await start()
    await shiftKitten(move)
    const run = move.generate()

    move.cancel()
    await vi.runAllTimersAsync()
    await run

    expect(move.phase.value.kind).toBe('arranging')
  })

  it('caps a photo at four things', async () => {
    const move = await startUpload()
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
      stubImage(decodes)
      const move = await start()

      await move.useFile(new File(['x'], 'photo.png', { type: 'image/png' }))

      expect(move.image.value?.name).toBe(expected)
    }
  )

  it('detects the example again when going back to it from an upload', async () => {
    const move = await startUpload()
    move.useExample()
    expect(move.objects.value).toEqual([])
    await vi.advanceTimersByTimeAsync(700)
    expect(move.objects.value).toHaveLength(3)
  })
})
