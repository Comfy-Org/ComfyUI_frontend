import { describe, expect, it } from 'vitest'

import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import {
  WIDGET_HISTORY_LIMIT,
  ownsNodeHistory,
  useWidgetHistoryStore
} from './widgetHistoryStore'

function scopeOf(rootGraphId: string, nodeId = 1, name = 'bboxes') {
  return {
    rootGraphId,
    widgetId: widgetId(rootGraphId, toNodeId(nodeId), name)
  }
}

const scope = scopeOf('root-a')

type Store = ReturnType<typeof useWidgetHistoryStore>

function recordEdits(
  store: Store,
  edits: readonly (readonly [unknown, string | undefined])[]
) {
  edits.forEach(([previous, mergeKey]) =>
    store.record(scope, previous, mergeKey)
  )
}

function undoAll(store: Store): unknown[] {
  const undone: unknown[] = []
  for (
    let step = store.undo(scope, 'now');
    step;
    step = store.undo(scope, step.value)
  ) {
    undone.push(step.value)
  }
  return undone
}

describe(ownsNodeHistory, () => {
  it.for([
    { type: 'boundingbox', owns: true },
    { type: 'boundingboxes', owns: true },
    { type: 'colors', owns: true },
    { type: 'curve', owns: true },
    { type: 'imagecrop', owns: true },
    { type: 'lightinfo', owns: true },
    { type: 'range', owns: true },
    { type: 'videoedit', owns: true },
    { type: 'number', owns: false },
    { type: undefined, owns: false }
  ])('returns $owns for widget type $type', ({ type, owns }) => {
    expect(ownsNodeHistory({ type })).toBe(owns)
  })
})

describe(useWidgetHistoryStore, () => {
  it('undoes to the recorded value and redoes back to the current one', () => {
    const store = useWidgetHistoryStore()
    store.record(scope, 'before')

    expect(store.undo(scope, 'after')).toEqual({ value: 'before' })
    expect(store.canUndo(scope)).toBe(false)
    expect(store.redo(scope, 'before')).toEqual({ value: 'after' })
    expect(store.canRedo(scope)).toBe(false)
    expect(store.canUndo(scope)).toBe(true)
  })

  it('keeps the shared baseline across steps until the widget is forgotten', () => {
    const store = useWidgetHistoryStore()
    store.setBaseline(scope, 'shown')
    store.record(scope, 'before')
    store.undo(scope, 'after')

    expect(store.baselineOf(scope)).toEqual({ value: 'shown' })
    store.forget(scope)
    expect(store.baselineOf(scope)).toBeUndefined()
  })

  it.for(['undo', 'redo'] as const)(
    'returns nothing to %s for an untouched widget',
    (direction) => {
      expect(useWidgetHistoryStore()[direction](scope, 'value')).toBeUndefined()
    }
  )

  it('keeps only the latest steps', () => {
    const store = useWidgetHistoryStore()
    recordEdits(
      store,
      Array.from({ length: WIDGET_HISTORY_LIMIT + 2 }, (_, step) => [
        step,
        undefined
      ])
    )

    expect(undoAll(store)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  })

  it.for([
    {
      case: 'the same key',
      edits: [
        ['first', 'text:0'],
        ['second', 'text:0']
      ],
      undone: ['first']
    },
    {
      case: 'different keys',
      edits: [
        ['first', 'text:0'],
        ['second', 'text:1']
      ],
      undone: ['second', 'first']
    },
    {
      case: 'no key',
      edits: [
        ['first', undefined],
        ['second', undefined]
      ],
      undone: ['second', 'first']
    }
  ] as const)('undoes edits with $case', ({ edits, undone }) => {
    const store = useWidgetHistoryStore()
    recordEdits(store, edits)

    expect(undoAll(store)).toEqual(undone)
  })

  it('does not merge into a step that was undone', () => {
    const store = useWidgetHistoryStore()
    store.record(scope, 'a', 'text:0')
    store.undo(scope, 'b')
    store.record(scope, 'a', 'text:0')
    store.record(scope, 'c', 'text:0')

    expect(store.undo(scope, 'd')).toEqual({ value: 'a' })
    expect(store.canUndo(scope)).toBe(false)
  })

  it('drops the redo branch when a new step is recorded', () => {
    const store = useWidgetHistoryStore()
    store.record(scope, 'a')
    store.undo(scope, 'b')
    store.record(scope, 'a')

    expect(store.canRedo(scope)).toBe(false)
  })

  it('keeps stored values isolated from later mutation', () => {
    const store = useWidgetHistoryStore()
    const recorded = [{ x: 1 }]
    store.record(scope, recorded)
    recorded[0].x = 99

    const step = store.undo(scope, [])
    expect(step?.value).toEqual([{ x: 1 }])
  })

  it('keeps separate histories per widget and per workflow', () => {
    const store = useWidgetHistoryStore()
    store.record(scope, 'a')

    expect(store.canUndo(scopeOf('root-a', 2))).toBe(false)
    expect(store.canUndo(scopeOf('root-a', 1, 'other'))).toBe(false)
    expect(store.canUndo(scopeOf('root-b'))).toBe(false)
  })

  it('forgets histories of widgets that are no longer live in that workflow', () => {
    const store = useWidgetHistoryStore()
    const kept = scopeOf('root-a', 1)
    const removed = scopeOf('root-a', 2)
    const otherWorkflow = scopeOf('root-b', 2)
    store.record(kept, 'a')
    store.record(removed, 'a')
    store.record(otherWorkflow, 'a')

    store.retainLive('root-a', new Set([kept.widgetId]))

    expect(store.canUndo(kept)).toBe(true)
    expect(store.canUndo(removed)).toBe(false)
    expect(store.canUndo(otherWorkflow)).toBe(true)
  })

  it('forgets a workflow once none of its widgets are live', () => {
    const store = useWidgetHistoryStore()
    store.record(scope, 'a')

    store.retainLive('root-a', new Set())
    store.record(scopeOf('root-a', 3), 'b')

    expect(store.canUndo(scope)).toBe(false)
    expect(store.canUndo(scopeOf('root-a', 3))).toBe(true)
  })

  it('forgets the history of one widget only', () => {
    const store = useWidgetHistoryStore()
    const sibling = scopeOf('root-a', 2)
    store.record(scope, 'a')
    store.record(sibling, 'a')

    store.forget(scope)

    expect(store.canUndo(scope)).toBe(false)
    expect(store.canUndo(sibling)).toBe(true)
  })

  it('forgets a workflow once its last widget history is forgotten', () => {
    const store = useWidgetHistoryStore()
    store.record(scope, 'a')

    store.forget(scope)
    store.forget(scope)
    store.record(scopeOf('root-a', 3), 'b')

    expect(store.canUndo(scopeOf('root-a', 3))).toBe(true)
  })

  it('clears every history of one workflow', () => {
    const store = useWidgetHistoryStore()
    const closed = scopeOf('root-a')
    const open = scopeOf('root-b')
    store.record(closed, 'a')
    store.record(open, 'a')

    store.clearWorkflow('root-a')

    expect(store.canUndo(closed)).toBe(false)
    expect(store.canUndo(open)).toBe(true)
  })
})
