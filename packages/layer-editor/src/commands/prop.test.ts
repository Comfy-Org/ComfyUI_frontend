import { describe, expect, it } from 'vitest'

import { Dirty, History } from '../history'
import { PropCommand } from './prop'

describe('PropCommand', () => {
  it('sets on redo and reverts on undo', () => {
    const obj = { opacity: 1 }
    const cmd = new PropCommand(
      'Opacity',
      Dirty.META,
      () => obj.opacity,
      (v) => (obj.opacity = v),
      1,
      0.5
    )
    cmd.apply('undo')
    expect(obj.opacity).toBe(1)
    cmd.apply('redo')
    expect(obj.opacity).toBe(0.5)
  })

  it('coalesces same-mergeKey edits into one undo step (slider drag)', () => {
    const obj = { opacity: 1 }
    const history = new History()
    const set = (v: number) => (obj.opacity = v)
    obj.opacity = 0.8
    history.push(
      new PropCommand(
        'Opacity',
        Dirty.META,
        () => obj.opacity,
        set,
        1,
        0.8,
        'opacity:x'
      )
    )
    obj.opacity = 0.5
    history.push(
      new PropCommand(
        'Opacity',
        Dirty.META,
        () => obj.opacity,
        set,
        0.8,
        0.5,
        'opacity:x'
      )
    )

    expect(history.labels().undo).toHaveLength(1)
    history.undo()
    expect(obj.opacity).toBe(1)
  })

  it('does not merge across different keys', () => {
    const obj = { a: 0, b: 0 }
    const history = new History()
    history.push(
      new PropCommand(
        'A',
        Dirty.META,
        () => obj.a,
        (v) => (obj.a = v),
        0,
        1,
        'a'
      )
    )
    history.push(
      new PropCommand(
        'B',
        Dirty.META,
        () => obj.b,
        (v) => (obj.b = v),
        0,
        1,
        'b'
      )
    )
    expect(history.labels().undo).toHaveLength(2)
  })
})
