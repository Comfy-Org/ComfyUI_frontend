import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import type { WidgetHistoryScope } from '@/stores/widgetHistoryStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { useWidgetValueHistory } from './useWidgetValueHistory'

const defaultScope: WidgetHistoryScope = {
  rootGraphId: 'root',
  widgetId: widgetId('root', toNodeId(1), 'bboxes')
}

function setup(
  initial: unknown,
  scope: WidgetHistoryScope | null = defaultScope
) {
  const value = ref(initial)
  const history = useWidgetValueHistory({
    scope: () => scope,
    read: () => value.value,
    apply: (next) => {
      value.value = next
    }
  })
  const edit = (next: unknown, mergeKey?: string) => {
    value.value = next
    history.commit(mergeKey)
  }
  return { value, history, edit }
}

function setupWithDelayedApply(initial: unknown) {
  const value = ref(initial)
  const pending: unknown[] = []
  const history = useWidgetValueHistory({
    scope: () => defaultScope,
    read: () => value.value,
    apply: (next) => {
      pending.push(next)
    }
  })
  const propagate = () => {
    value.value = pending.at(-1)
  }
  return { value, history, propagate }
}

describe(useWidgetValueHistory, () => {
  it('undoes an edit to the committed value and redoes it', () => {
    const { value, history, edit } = setup(['a'])
    edit(['a', 'b'])

    history.undo()
    expect(value.value).toEqual(['a'])
    expect(history.canRedo.value).toBe(true)

    history.redo()
    expect(value.value).toEqual(['a', 'b'])
    expect(history.canUndo.value).toBe(true)
  })

  it('records nothing when a commit does not change the value', () => {
    const { history, edit } = setup(['a'])
    edit(['a'])

    expect(history.canUndo.value).toBe(false)
  })

  it('undoes only to the start of edits that share a merge key', () => {
    const { value, history, edit } = setup('')
    edit('h', 'text')
    edit('hi', 'text')

    history.undo()
    expect(value.value).toBe('')
    expect(history.canUndo.value).toBe(false)
  })

  it('does not record an undo as a new step', () => {
    const { history, edit } = setup(1)
    edit(2)
    edit(3)

    history.undo()

    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(true)
  })

  it('keeps earlier steps when syncing the baseline to a loaded value', () => {
    const { value, history, edit } = setup(1)
    edit(2)
    value.value = 10
    history.syncBaseline()
    edit(11)

    history.undo()
    expect(value.value).toBe(10)
    expect(history.canUndo.value).toBe(true)
  })

  it('discards steps recorded against a value replaced from outside', () => {
    const { value, history, edit } = setup('a')
    edit('b')
    value.value = 'c'

    history.discardHistory()

    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
    edit('d')
    history.undo()
    expect(value.value).toBe('c')
  })

  it('keeps the restored value as the baseline when it propagates later', () => {
    const { value, history, propagate } = setupWithDelayedApply(1)
    value.value = 2
    history.commit()

    history.undo()
    propagate()
    history.commit()

    expect(value.value).toBe(1)
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(true)
  })

  it('settles the baseline on the value the widget actually applied', async () => {
    const value = ref(1.4)
    const history = useWidgetValueHistory({
      scope: () => defaultScope,
      read: () => value.value,
      apply: (next) => {
        value.value = Math.round(Number(next))
      }
    })
    value.value = 3
    history.commit()

    history.undo()
    await nextTick()
    history.commit()

    expect(value.value).toBe(1)
    expect(history.canUndo.value).toBe(false)
  })

  it('shares the baseline between instances of the same widget', () => {
    const value = ref(1)
    const options = {
      scope: () => defaultScope,
      read: () => value.value,
      apply: (next: unknown) => {
        value.value = Number(next)
      }
    }
    const canvas = useWidgetValueHistory(options)
    const appMode = useWidgetValueHistory(options)
    value.value = 2
    appMode.commit()
    value.value = 3
    canvas.commit()

    canvas.undo()
    expect(value.value).toBe(2)
    canvas.undo()
    expect(value.value).toBe(1)
  })

  it('keeps no history while the widget has no scope', () => {
    const { value, history, edit } = setup(1, null)
    edit(2)

    history.undo()
    expect(value.value).toBe(2)
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
  })
})
