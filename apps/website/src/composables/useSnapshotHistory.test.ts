import { describe, expect, it } from 'vitest'

import { useSnapshotHistory } from './useSnapshotHistory'

describe('useSnapshotHistory', () => {
  it('undoes and redoes each change', () => {
    const history = useSnapshotHistory(1)
    history.change(2)
    history.change(3)

    history.undo()
    expect(history.state.value).toBe(2)
    history.undo()
    expect(history.state.value).toBe(1)
    expect(history.canUndo.value).toBe(false)
    history.redo()
    expect(history.state.value).toBe(2)
    expect(history.canRedo.value).toBe(true)
  })

  it('folds a run of changes with one key into one step', () => {
    const history = useSnapshotHistory(0)
    history.change(10, 'slider')
    history.change(20, 'slider')
    history.change(30, 'other')

    history.undo()
    expect(history.state.value).toBe(20)
    history.undo()
    expect(history.state.value).toBe(0)
  })

  it('drops the redo steps on a new change and forgets everything on reset', () => {
    const history = useSnapshotHistory('a')
    history.change('b')
    history.undo()
    history.change('c')
    expect(history.canRedo.value).toBe(false)

    history.reset('z')
    expect(history.state.value).toBe('z')
    expect(history.canUndo.value).toBe(false)
  })
})
