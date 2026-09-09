import { describe, expect, it } from 'vitest'

import type { Command, Direction } from './history'
import { CommandGroup, DIRTY_ALL, Dirty, History } from './history'

class TestCommand implements Command {
  readonly log: Direction[] = []
  constructor(
    readonly label: string,
    readonly dirtyMask: number = Dirty.DRAWABLE,
    private readonly bytes: number = 8,
    private readonly refs: string[] = []
  ) {}

  apply(dir: Direction): void {
    this.log.push(dir)
  }

  sizeBytes(): number {
    return this.bytes
  }

  contentRefs(): string[] {
    return this.refs
  }
}

class MergingCommand extends TestCommand {
  merged = 0
  constructor(readonly key: string) {
    super(`merge:${key}`)
  }

  tryMerge(prev: Command): boolean {
    if (prev instanceof MergingCommand && prev.key === this.key) {
      prev.merged += 1
      return true
    }
    return false
  }
}

describe('History — undo/redo', () => {
  it('applies undo then redo in stack order', () => {
    const h = new History()
    const a = new TestCommand('a')
    const b = new TestCommand('b')
    h.push(a)
    h.push(b)
    expect(h.canUndo()).toBe(true)
    expect(h.canRedo()).toBe(false)

    h.undo()
    expect(b.log).toEqual(['undo'])
    expect(a.log).toEqual([])
    expect(h.canRedo()).toBe(true)

    h.redo()
    expect(b.log).toEqual(['undo', 'redo'])
    expect(h.canRedo()).toBe(false)
  })

  it('undo/redo on empty stacks is a no-op', () => {
    const h = new History()
    h.undo()
    h.redo()
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
  })

  it('a new push clears the redo stack', () => {
    const h = new History()
    h.push(new TestCommand('a'))
    h.undo()
    expect(h.canRedo()).toBe(true)
    h.push(new TestCommand('b'))
    expect(h.canRedo()).toBe(false)
  })

  it('labels reports both stacks', () => {
    const h = new History()
    h.push(new TestCommand('a'))
    h.push(new TestCommand('b'))
    h.undo()
    expect(h.labels()).toEqual({ undo: ['a'], redo: ['b'] })
  })

  it('clear resets everything and emits DIRTY_ALL', () => {
    const h = new History()
    let mask = 0
    h.onChange((m) => (mask = m))
    h.push(new TestCommand('a'))
    h.clear()
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
    expect(h.dirty()).toBe(false)
    expect(mask).toBe(DIRTY_ALL)
  })
})

describe('History — grouping', () => {
  it('a group is one undo step applied in reverse on undo', () => {
    const h = new History()
    const order: string[] = []
    const cmd = (label: string): Command => ({
      label,
      dirtyMask: Dirty.STRUCTURE,
      apply: (dir) => order.push(`${label}:${dir}`),
      sizeBytes: () => 4
    })
    h.beginGroup('batch')
    h.push(cmd('first'))
    h.push(cmd('second'))
    h.endGroup()
    expect(h.labels().undo).toEqual(['batch'])

    h.undo()
    expect(order).toEqual(['second:undo', 'first:undo'])
    h.redo()
    expect(order).toEqual([
      'second:undo',
      'first:undo',
      'first:redo',
      'second:redo'
    ])
  })

  it('an empty group commits nothing', () => {
    const h = new History()
    h.beginGroup('nothing')
    h.endGroup()
    expect(h.canUndo()).toBe(false)
  })

  it('CommandGroup aggregates dirty masks, sizes and refs', () => {
    const g = new CommandGroup('g')
    g.children.push(new TestCommand('a', Dirty.DRAWABLE, 8, ['x']))
    g.children.push(new TestCommand('b', Dirty.META, 16, ['y']))
    expect(g.dirtyMask).toBe(Dirty.DRAWABLE | Dirty.META)
    expect(g.sizeBytes()).toBe(24)
    expect(g.contentRefs().sort()).toEqual(['x', 'y'])
    expect(g.empty).toBe(false)
  })
})

describe('History — merging', () => {
  it('merges consecutive commands with the same key into one step', () => {
    const h = new History()
    const first = new MergingCommand('opacity')
    h.push(first)
    h.push(new MergingCommand('opacity'))
    h.push(new MergingCommand('opacity'))
    expect(first.merged).toBe(2)
    expect(h.labels().undo).toEqual(['merge:opacity'])
  })

  it('never merges across an undo (pending redo)', () => {
    const h = new History()
    const first = new MergingCommand('opacity')
    h.push(first)
    h.undo()
    h.push(new MergingCommand('opacity'))
    expect(first.merged).toBe(0)
  })

  it('a merged edit is one dirty step that a single undo clears', () => {
    const h = new History()
    h.push(new MergingCommand('opacity'))
    h.push(new MergingCommand('opacity'))
    h.push(new MergingCommand('opacity'))
    expect(h.dirty()).toBe(true)
    h.undo()
    expect(h.dirty()).toBe(false)
  })

  it('redo after undoing a post-save merge reads dirty again', () => {
    const h = new History()
    h.push(new MergingCommand('opacity'))
    h.push(new MergingCommand('opacity'))
    h.markSaved()
    h.push(new MergingCommand('opacity'))
    h.undo()
    expect(h.dirty()).toBe(false)
    h.redo()
    expect(h.dirty()).toBe(true)
  })

  it('never merges across a save point, so the new edit stays undoable to clean', () => {
    const h = new History()
    const first = new MergingCommand('opacity')
    h.push(first)
    h.markSaved()
    h.push(new MergingCommand('opacity'))
    expect(first.merged).toBe(0)
    expect(h.dirty()).toBe(true)
    h.undo()
    expect(h.dirty()).toBe(false)
  })
})

describe('History — dirty tracking and eviction', () => {
  it('dirty flips on push and returns clean when undone back to the save point', () => {
    const h = new History()
    expect(h.dirty()).toBe(false)
    h.push(new TestCommand('a'))
    expect(h.dirty()).toBe(true)
    h.undo()
    expect(h.dirty()).toBe(false)
    h.redo()
    h.markSaved()
    expect(h.dirty()).toBe(false)
  })

  it('evicts oldest steps over budget and the save point becomes unreachable', () => {
    const h = new History({ byteBudget: 32, minSteps: 2 })
    for (let i = 0; i < 5; i++)
      h.push(new TestCommand(`c${i}`, Dirty.DRAWABLE, 16))
    expect(h.labels().undo.length).toBeLessThan(5)
    h.markSaved()
    expect(h.dirty()).toBe(false)
  })

  it('keeps at least minSteps even when over budget', () => {
    const h = new History({ byteBudget: 1, minSteps: 3 })
    for (let i = 0; i < 6; i++)
      h.push(new TestCommand(`c${i}`, Dirty.DRAWABLE, 64))
    expect(h.labels().undo).toHaveLength(3)
  })

  it('a branch that discards the save point stays dirty', () => {
    const h = new History()
    h.push(new TestCommand('a'))
    h.markSaved()
    h.undo()
    h.push(new TestCommand('b'))
    expect(h.dirty()).toBe(true)
    h.undo()
    expect(h.dirty()).toBe(true)
    h.markSaved()
    expect(h.dirty()).toBe(false)
  })

  it('an evicted history stays dirty until the next markSaved', () => {
    const h = new History({ byteBudget: 1, minSteps: 1 })
    h.push(new TestCommand('a', Dirty.DRAWABLE, 64))
    h.push(new TestCommand('b', Dirty.DRAWABLE, 64))
    while (h.canUndo()) h.undo()
    expect(h.dirty()).toBe(true)
  })
})

describe('History — listeners and content refs', () => {
  it('notifies with the command dirty mask and honours unsubscribe', () => {
    const h = new History()
    const masks: number[] = []
    const off = h.onChange((m) => masks.push(m))
    h.push(new TestCommand('a', Dirty.SELECTION))
    h.undo()
    off()
    h.redo()
    expect(masks).toEqual([Dirty.SELECTION, Dirty.SELECTION])
  })

  it('contentRefs unions refs across undo and redo stacks', () => {
    const h = new History()
    h.push(new TestCommand('a', Dirty.DRAWABLE, 8, ['pix-a']))
    h.push(new TestCommand('b', Dirty.DRAWABLE, 8, ['pix-b']))
    h.undo()
    expect([...h.contentRefs()].sort()).toEqual(['pix-a', 'pix-b'])
  })
})
