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

function shift(move: ReturnType<typeof useMoveAnything>, id: string) {
  const object = move.objects.value.find((candidate) => candidate.id === id)
  if (!object) throw new Error(`no object ${id}`)
  move.checkpoint()
  move.place(id, moveRect(object.to, 0.2, 0))
}

beforeEach(() => {
  vi.useFakeTimers()
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

describe('useMoveAnything', () => {
  it('opens the example with its three things selected and nothing to run yet', () => {
    const move = start()
    expect(move.objects.value.map(({ label }) => label)).toEqual([
      'Orange kitten',
      'Succulent',
      'Succulent'
    ])
    expect(move.canGenerate.value).toBe(false)
  })

  it('undoes and redoes a move', () => {
    const move = start()
    shift(move, 'o1')
    expect(move.moved.value).toHaveLength(1)

    move.undo()
    expect(move.moved.value).toHaveLength(0)
    move.redo()
    expect(move.moved.value).toHaveLength(1)
  })

  it('runs a move and lands on the result, then goes back to arranging', async () => {
    const move = start()
    shift(move, 'o1')

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
    shift(move, 'o2')
    const run = move.generate()

    move.cancel()
    await vi.runAllTimersAsync()
    await run

    expect(move.phase.value.kind).toBe('arranging')
  })

  it('caps a photo at four things', () => {
    const move = start()
    move.add({ x: 0.6, y: 0.1, w: 0.1, h: 0.1 })
    expect(move.full.value).toBe(true)

    move.add({ x: 0.8, y: 0.1, w: 0.1, h: 0.1 })
    expect(move.objects.value).toHaveLength(4)
  })
})
