import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useMinimapLayerStore } from '@/stores/minimapLayerStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import {
  createMockCanvas2DContext,
  createNodeState
} from '@/utils/__tests__/litegraphTestUtils'

import { useAgentGeneratedNodesStore } from '../stores/agentGeneratedNodesStore'

describe('useAgentMinimapLayer', () => {
  it.for([
    { name: 'motion enabled', disabled: false, reduced: false },
    { name: 'application disables motion', disabled: true, reduced: false },
    { name: 'OS reduces motion', disabled: false, reduced: true }
  ])(
    '$name controls growth and ends an active animation',
    async ({ disabled, reduced }) => {
      const matchMedia = window.matchMedia.bind(window)
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        const result = matchMedia(query)
        Object.defineProperty(result, 'matches', {
          value: query === '(prefers-reduced-motion: reduce)' && reduced
        })
        return result
      })
      vi.spyOn(performance, 'now').mockReturnValue(1_000)
      const settings = useSettingStore()
      settings.settingValues['Comfy.Appearance.DisableAnimations'] = disabled
      const graph = new LGraph()
      const graphScope = graphScopeOf(graph)
      const generatedNodes = useAgentGeneratedNodesStore()
      const nodeId = toNodeId(1)
      useNodeDataStore().registerNode(
        graphScope,
        createNodeState({ id: nodeId, graphId: graphScope.owningGraphId }),
        { source: 'agent-remote', actor: 'agent:test', opId: 'op-1' }
      )
      const layers = useMinimapLayerStore()
      try {
        await nextTick()
        const layer = layers.layers[0]
        const ctx = createMockCanvas2DContext()
        const frame = {
          ctx,
          graph,
          now: 1_000,
          nodes: [{ nodeId, x: 10, y: 20, width: 10, height: 20 }]
        }
        layer.draw(frame)
        const moving = !disabled && !reduced
        expect(layer.isAnimating(1_000)).toBe(moving)
        expect(ctx.fillRect).toHaveBeenLastCalledWith(
          ...(moving ? [13.25, 26.5, 3.5, 7] : [10, 20, 10, 20])
        )

        settings.settingValues['Comfy.Appearance.DisableAnimations'] = true
        await nextTick()
        expect(layer.isAnimating(1_010)).toBe(false)
        layer.draw({ ...frame, now: 1_010 })
        expect(ctx.fillRect).toHaveBeenLastCalledWith(10, 20, 10, 20)
      } finally {
        generatedNodes.$dispose()
      }
      expect(layers.layers).toHaveLength(0)
    }
  )
})
