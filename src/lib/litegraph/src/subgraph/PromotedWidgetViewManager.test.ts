import { describe, expect, test } from 'vitest'

import { PromotedWidgetViewManager } from '@/lib/litegraph/src/subgraph/PromotedWidgetViewManager'

type TestPromotionEntry = {
  sourceNodeId: string
  sourceWidgetName: string
  viewKey?: string
}

function makeView(entry: TestPromotionEntry) {
  const baseKey = `${entry.sourceNodeId}:${entry.sourceWidgetName}`

  return {
    key: entry.viewKey ? `${baseKey}:${entry.viewKey}` : baseKey
  }
}

describe('PromotedWidgetViewManager', () => {
  test('returns memoized array when entries reference is unchanged', () => {
    const manager = new PromotedWidgetViewManager<{ key: string }>()
    const entries = [{ sourceNodeId: '1', sourceWidgetName: 'widgetA' }]

    const first = manager.reconcile(entries, makeView)
    const second = manager.reconcile(entries, makeView)

    expect(second).toBe(first)
    expect(second[0]).toBe(first[0])
  })

  test('preserves view identity while reflecting order changes', () => {
    const manager = new PromotedWidgetViewManager<{ key: string }>()

    const firstPass = manager.reconcile(
      [
        { sourceNodeId: '1', sourceWidgetName: 'widgetA' },
        { sourceNodeId: '1', sourceWidgetName: 'widgetB' }
      ],
      makeView
    )

    const reordered = manager.reconcile(
      [
        { sourceNodeId: '1', sourceWidgetName: 'widgetB' },
        { sourceNodeId: '1', sourceWidgetName: 'widgetA' }
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
        { sourceNodeId: '1', sourceWidgetName: 'widgetA' },
        { sourceNodeId: '1', sourceWidgetName: 'widgetB' },
        { sourceNodeId: '1', sourceWidgetName: 'widgetA' }
      ],
      makeView
    )
    expect(first.map((view) => view.key)).toStrictEqual([
      '1:widgetA',
      '1:widgetB'
    ])

    manager.reconcile(
      [{ sourceNodeId: '1', sourceWidgetName: 'widgetB' }],
      makeView
    )

    const restored = manager.reconcile(
      [
        { sourceNodeId: '1', sourceWidgetName: 'widgetB' },
        { sourceNodeId: '1', sourceWidgetName: 'widgetA' }
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
        { sourceNodeId: '1', sourceWidgetName: 'widgetA', viewKey: 'slotA' },
        { sourceNodeId: '1', sourceWidgetName: 'widgetA', viewKey: 'slotB' }
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
        { sourceNodeId: '1', sourceWidgetName: 'widgetA', viewKey: 'slotA' },
        { sourceNodeId: '1', sourceWidgetName: 'widgetA', viewKey: 'slotB' }
      ],
      makeView
    )

    manager.removeByViewKey('1', 'widgetA', 'slotA')

    const secondPass = manager.reconcile(
      [
        { sourceNodeId: '1', sourceWidgetName: 'widgetA', viewKey: 'slotA' },
        { sourceNodeId: '1', sourceWidgetName: 'widgetA', viewKey: 'slotB' }
      ],
      makeView
    )

    expect(secondPass[0]).not.toBe(firstPass[0])
    expect(secondPass[1]).toBe(firstPass[1])
  })
})
