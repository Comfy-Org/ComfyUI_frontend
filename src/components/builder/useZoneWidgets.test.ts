import { describe, expect, it, vi } from 'vitest'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'

vi.mock('@/composables/graph/useGraphNodeManager', () => ({
  extractVueNodeData: vi.fn()
}))
vi.mock('@/core/graph/subgraph/promotedWidgetTypes', () => ({
  isPromotedWidgetView: vi.fn()
}))
vi.mock('@/lib/litegraph/src/types/globalEnums', async (importOriginal) => ({
  ...(await importOriginal()),
  LGraphEventMode: { ALWAYS: 0 }
}))
vi.mock('@/utils/litegraphUtil', () => ({
  resolveNodeWidget: vi.fn()
}))
vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: vi.fn()
}))
vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: vi.fn()
}))

import { inputsForZone } from './useZoneWidgets'

describe('useZoneWidgets', () => {
  describe('inputsForZone', () => {
    const inputs: [NodeId, string][] = [
      [1, 'prompt'],
      [2, 'width'],
      [1, 'steps'],
      [3, 'seed']
    ]

    function makeGetZone(
      assignments: Record<string, string>
    ): (nodeId: NodeId, widgetName: string) => string | undefined {
      return (nodeId, widgetName) => assignments[`${nodeId}:${widgetName}`]
    }

    it('returns inputs matching the given zone', () => {
      const getZone = makeGetZone({
        '1:prompt': 'z1',
        '2:width': 'z2',
        '1:steps': 'z1',
        '3:seed': 'z2'
      })

      const result = inputsForZone(inputs, getZone, 'z1')
      expect(result).toEqual([
        [1, 'prompt'],
        [1, 'steps']
      ])
    })

    it('returns empty array when no inputs match', () => {
      const getZone = makeGetZone({
        '1:prompt': 'z1',
        '2:width': 'z1'
      })

      const result = inputsForZone(inputs, getZone, 'z2')
      expect(result).toEqual([])
    })

    it('handles empty inputs', () => {
      const getZone = makeGetZone({})
      expect(inputsForZone([], getZone, 'z1')).toEqual([])
    })

    it('handles unassigned inputs (getZone returns undefined)', () => {
      const getZone = makeGetZone({ '1:prompt': 'z1' })

      // Only 1:prompt is assigned to z1; rest are undefined
      const result = inputsForZone(inputs, getZone, 'z1')
      expect(result).toEqual([[1, 'prompt']])
    })

    it('filters non-contiguous inputs for the same node across zones', () => {
      const getZone = makeGetZone({
        '1:prompt': 'z1',
        '2:width': 'z2',
        '1:steps': 'z2', // same node 1, different zone
        '3:seed': 'z1'
      })

      const z1 = inputsForZone(inputs, getZone, 'z1')
      const z2 = inputsForZone(inputs, getZone, 'z2')

      expect(z1).toEqual([
        [1, 'prompt'],
        [3, 'seed']
      ])
      expect(z2).toEqual([
        [2, 'width'],
        [1, 'steps']
      ])
    })
  })
})
