import { describe, expect, it } from 'vitest'

import { checkpoint, commit, historyOf, redo, replace, undo } from './history'

describe('history', () => {
  it('undoes and redoes committed changes in order', () => {
    const steps = commit(commit(historyOf('a'), 'b'), 'c')
    const back = undo(undo(steps))
    expect(back.present).toBe('a')
    expect(redo(back).present).toBe('b')
  })

  it('undoes a whole drag as one step', () => {
    const dragged = replace(replace(checkpoint(historyOf(0)), 1), 2)
    expect(dragged.present).toBe(2)
    expect(undo(dragged).present).toBe(0)
  })

  it('forgets what was undone once something new changes', () => {
    const changed = commit(undo(commit(historyOf('a'), 'b')), 'c')
    expect(changed.future).toEqual([])
    expect(redo(changed)).toBe(changed)
  })

  it('stays put with nothing to undo', () => {
    const start = historyOf('a')
    expect(undo(start)).toBe(start)
  })
})
