import { describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'

import {
  WIDGET_HISTORY_LIMIT,
  asHistoryReference,
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
    { type: 'painter', owns: true },
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

  describe('latestTraveler', () => {
    const first = scopeOf('root-a', 1, 'first')
    const second = scopeOf('root-a', 1, 'second')
    const onOtherNode = scopeOf('root-a', 2)
    const node = { rootGraphId: 'root-a', graphId: 'root-a', nodeId: '1' }

    function mount(store: Store, target: typeof scope) {
      const travel = vi.fn()
      const unmount = store.registerTraveler({
        scope: () => target,
        canTravel: (direction) =>
          direction === 'undo' ? store.canUndo(target) : store.canRedo(target),
        travel
      })
      return { travel, unmount }
    }

    async function travelLatest(store: Store, direction: 'undo' | 'redo') {
      await store.latestTraveler(node, direction)?.travel()
    }

    it('travels the widget of the node whose step was recorded last', async () => {
      const store = useWidgetHistoryStore()
      const older = mount(store, first)
      const newer = mount(store, second)
      store.record(first, 'a')
      store.record(second, 'b')

      await travelLatest(store, 'undo')

      expect(newer.travel).toHaveBeenCalledExactlyOnceWith('undo')
      expect(older.travel).not.toHaveBeenCalled()
    })

    it('treats a merged edit as the latest step', async () => {
      const store = useWidgetHistoryStore()
      const merged = mount(store, first)
      const other = mount(store, second)
      store.record(first, 'a', 'drag')
      store.record(second, 'b')
      store.record(first, 'a2', 'drag')

      await travelLatest(store, 'undo')

      expect(merged.travel).toHaveBeenCalledOnce()
      expect(other.travel).not.toHaveBeenCalled()
    })

    it('redoes the widget that was undone last', async () => {
      const store = useWidgetHistoryStore()
      const undoneFirst = mount(store, second)
      const undoneLast = mount(store, first)
      store.record(first, 'a')
      store.record(second, 'b')
      store.undo(second, 'b2')
      store.undo(first, 'a2')

      await travelLatest(store, 'redo')

      expect(undoneLast.travel).toHaveBeenCalledExactlyOnceWith('redo')
      expect(undoneFirst.travel).not.toHaveBeenCalled()
    })

    it('ignores a newer step on another node', async () => {
      const store = useWidgetHistoryStore()
      const focused = mount(store, first)
      const other = mount(store, onOtherNode)
      store.record(first, 'a')
      store.record(onOtherNode, 'b')

      await travelLatest(store, 'undo')

      expect(focused.travel).toHaveBeenCalledOnce()
      expect(other.travel).not.toHaveBeenCalled()
    })

    it('finds nothing without a step, after unmount, or in another workflow', () => {
      const store = useWidgetHistoryStore()
      const { unmount } = mount(store, first)

      expect(store.latestTraveler(node, 'undo')).toBeUndefined()
      store.record(first, 'a')
      expect(
        store.latestTraveler({ ...node, rootGraphId: 'root-b' }, 'undo')
      ).toBeUndefined()
      unmount()
      expect(store.latestTraveler(node, 'undo')).toBeUndefined()
    })
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

  it.for([
    {
      case: 'a value marked as a history reference by reference',
      mark: asHistoryReference,
      same: true
    },
    { case: 'a frozen value as a copy', mark: Object.freeze, same: false },
    {
      case: 'a plain value as a copy',
      mark: <T>(value: T) => value,
      same: false
    }
  ])('stores $case', ({ mark, same }) => {
    const store = useWidgetHistoryStore()
    const value = mark({ pixels: [1, 2, 3] })
    store.record(scope, value)

    const step = store.undo(scope, 'after')

    expect(step?.value === value).toBe(same)
    expect(step?.value).toEqual(value)
  })

  it('lists the steps it keeps and drops one of them', () => {
    const store = useWidgetHistoryStore()
    const other = scopeOf('root-a', 2)
    store.record(scope, 'first')
    store.record(scope, 'second')
    store.undo(scope, 'redone')
    store.record(other, 'elsewhere')

    store.dropStep(scope, 'first')

    expect(store.storedSteps()).toEqual([
      { scope, value: 'redone' },
      { scope: other, value: 'elsewhere' }
    ])
  })

  it('peeks at the next step in each direction without taking it', () => {
    const store = useWidgetHistoryStore()
    store.record(scope, 'before')
    store.undo(scope, 'after')
    store.record(scope, 'other')

    expect(store.peek(scope, 'undo')).toEqual({ value: 'other' })
    expect(store.peek(scope, 'redo')).toBeUndefined()
    expect(store.canUndo(scope)).toBe(true)
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
