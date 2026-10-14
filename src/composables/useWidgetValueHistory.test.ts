import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

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

  it('keeps no history while the widget has no scope', () => {
    const { value, history, edit } = setup(1, null)
    edit(2)

    history.undo()
    expect(value.value).toBe(2)
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
  })
})
