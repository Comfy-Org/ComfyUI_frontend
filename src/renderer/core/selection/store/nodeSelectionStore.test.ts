import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Positionable } from '@/lib/litegraph/src/interfaces'

import { useNodeSelectionStore } from './nodeSelectionStore'

function mockPositionable(id?: number): Positionable {
  return { id } as unknown as Positionable
}

describe('useNodeSelectionStore', () => {
  let store: ReturnType<typeof useNodeSelectionStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useNodeSelectionStore()
  })

  it('initializes with empty selection', () => {
    expect(store.hasSelection).toBe(false)
    expect(store.selectionCount).toBe(0)
    expect(store.selectedNodeIds.size).toBe(0)
  })

  it('syncFromCanvas updates selection from items', () => {
    const items = [mockPositionable(1), mockPositionable(2)]
    store.syncFromCanvas(items)

    expect(store.selectionCount).toBe(2)
    expect(store.hasSelection).toBe(true)
    expect(store.selectedNodeIds).toEqual(new Set(['1', '2']))
  })

  it('syncFromCanvas skips items without id', () => {
    const items = [
      mockPositionable(1),
      mockPositionable(undefined),
      mockPositionable(3)
    ]
    store.syncFromCanvas(items)

    expect(store.selectionCount).toBe(2)
    expect(store.selectedNodeIds).toEqual(new Set(['1', '3']))
  })

  it('syncFromCanvas no-ops when selection unchanged', () => {
    const items = [mockPositionable(1), mockPositionable(2)]
    store.syncFromCanvas(items)
    const idsAfterFirst = store.selectedNodeIds

    store.syncFromCanvas(items)
    expect(store.selectedNodeIds.size).toBe(idsAfterFirst.size)
    expect([...store.selectedNodeIds]).toEqual([...idsAfterFirst])
  })

  it('clear empties selection', () => {
    store.syncFromCanvas([mockPositionable(1), mockPositionable(2)])
    expect(store.hasSelection).toBe(true)

    store.clear()
    expect(store.hasSelection).toBe(false)
    expect(store.selectionCount).toBe(0)
  })

  it('clear no-ops when already empty', () => {
    store.clear()
    expect(store.hasSelection).toBe(false)
    expect(store.selectionCount).toBe(0)
  })

  it('isSelected returns correct boolean', () => {
    store.syncFromCanvas([mockPositionable(1), mockPositionable(3)])

    expect(store.isSelected('1')).toBe(true)
    expect(store.isSelected('3')).toBe(true)
    expect(store.isSelected('2')).toBe(false)
    expect(store.isSelected('999')).toBe(false)
  })
})
