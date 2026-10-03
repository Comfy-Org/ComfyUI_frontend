import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { provideSelectionSource } from '@/platform/nodeApi/selection'
import { toNodeId } from '@/types/nodeId'

import { useCanvasStore } from './canvasStore'
import { installSelectionBridge } from './selectionBridge'

type SelectionSource = Parameters<typeof provideSelectionSource>[0]

const captured = vi.hoisted(() => ({
  provider: undefined as SelectionSource | undefined
}))
vi.mock(import('@/platform/nodeApi/selection'), () => ({
  provideSelectionSource: (provider: SelectionSource) => {
    captured.provider = provider
  }
}))

describe('selectionBridge', () => {
  beforeEach(() => {
    captured.provider = undefined
    useCanvasStore().selectedItems = []
  })

  it('reports node ids and excludes selected groups', async () => {
    installSelectionBridge()
    const emitted: string[][] = []
    const stop = captured.provider!((ids) => emitted.push([...ids]))
    const node = new LGraphNode('Sampler')
    node.id = toNodeId('7')

    useCanvasStore().selectedItems = [node, new LGraphGroup('Group')]
    await nextTick()

    expect(emitted).toEqual([['7']])
    stop()
  })

  it('reports deselection and unsubscribes cleanly', async () => {
    installSelectionBridge()
    const emitted: string[][] = []
    const stop = captured.provider!((ids) => emitted.push([...ids]))
    const node = new LGraphNode('Sampler')
    node.id = toNodeId('8')
    useCanvasStore().selectedItems = [node]
    await nextTick()
    useCanvasStore().selectedItems = []
    await nextTick()

    expect(emitted).toEqual([['8'], []])
    stop()
    useCanvasStore().selectedItems = [node]
    await nextTick()
    expect(emitted).toHaveLength(2)
  })
})
