import { describe, expect, test } from 'vitest'

import { PromotedWidgetViewManager } from '@/lib/litegraph/src/subgraph/PromotedWidgetViewManager'

type TestPromotionEntry = {
  interiorNodeId: string
  widgetName: string
  viewKey?: string
}

function makeView(entry: TestPromotionEntry) {
  const baseKey = `${entry.interiorNodeId}:${entry.widgetName}`

  return {
    key: entry.viewKey ? `${baseKey}:${entry.viewKey}` : baseKey
  }
}

describe('PromotedWidgetViewManager', () => {
  test('returns memoized array when entries reference is unchanged', () => {
    const manager = new PromotedWidgetViewManager<{ key: string }>()
    const entries = [{ interiorNodeId: '1', widgetName: 'widgetA' }]

    const first = manager.reconcile(entries, makeView)
    const second = manager.reconcile(entries, makeView)

    expect(second).toBe(first)
    expect(second[0]).toBe(first[0])
  })

  test('preserves view identity while reflecting order changes', () => {
    const manager = new PromotedWidgetViewManager<{ key: string }>()

    const firstPass = manager.reconcile(
      [
        { interiorNodeId: '1', widgetName: 'widgetA' },
        { interiorNodeId: '1', widgetName: 'widgetB' }
      ],
      makeView
    )

    const reordered = manager.reconcile(
      [
        { interiorNodeId: '1', widgetName: 'widgetB' },
        { interiorNodeId: '1', widgetName: 'widgetA' }
      ],
      makeView
    )

    expect(reordered[0]).toBe(firstPass[1])
    expect(reordered[1]).toBe(firstPass[0])
  })

  test('deduplicates by first occurrence and clears stale cache entries', () => {
    const manager = new PromotedWidgetViewManager<{ key: string }>()

    const first = manager.reconcile(
      [
        { interiorNodeId: '1', widgetName: 'widgetA' },
        { interiorNodeId: '1', widgetName: 'widgetB' },
        { interiorNodeId: '1', widgetName: 'widgetA' }
      ],
      makeView
    )
    expect(first.map((view) => view.key)).toStrictEqual([
      '1:widgetA',
      '1:widgetB'
    ])

    manager.reconcile(
      [{ interiorNodeId: '1', widgetName: 'widgetB' }],
      makeView
    )

    const restored = manager.reconcile(
      [
        { interiorNodeId: '1', widgetName: 'widgetB' },
        { interiorNodeId: '1', widgetName: 'widgetA' }
      ],
      makeView
    )

    expect(restored[0]).toBe(first[1])
    expect(restored[1]).not.toBe(first[0])
  })

  test('keeps distinct views for same source widget when viewKeys differ', () => {
    const manager = new PromotedWidgetViewManager<{ key: string }>()

    const views = manager.reconcile(
      [
        { interiorNodeId: '1', widgetName: 'widgetA', viewKey: 'slotA' },
        { interiorNodeId: '1', widgetName: 'widgetA', viewKey: 'slotB' }
      ],
      makeView
    )

    expect(views).toHaveLength(2)
    expect(views[0]).not.toBe(views[1])
    expect(views[0].key).toBe('1:widgetA:slotA')
    expect(views[1].key).toBe('1:widgetA:slotB')
  })

  test('removeByViewKey removes only the targeted keyed view', () => {
    const manager = new PromotedWidgetViewManager<{ key: string }>()

    const firstPass = manager.reconcile(
      [
        { interiorNodeId: '1', widgetName: 'widgetA', viewKey: 'slotA' },
        { interiorNodeId: '1', widgetName: 'widgetA', viewKey: 'slotB' }
      ],
      makeView
    )

    manager.removeByViewKey('1', 'widgetA', 'slotA')

    const secondPass = manager.reconcile(
      [
        { interiorNodeId: '1', widgetName: 'widgetA', viewKey: 'slotA' },
        { interiorNodeId: '1', widgetName: 'widgetA', viewKey: 'slotB' }
      ],
      makeView
    )

    expect(secondPass[0]).not.toBe(firstPass[0])
    expect(secondPass[1]).toBe(firstPass[1])
  })
})
