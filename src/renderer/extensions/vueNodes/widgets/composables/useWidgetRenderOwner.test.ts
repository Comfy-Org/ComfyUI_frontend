import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { computed, defineComponent, h } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import {
  WidgetRenderOwnerKey,
  useWidgetRenderOwner
} from './useWidgetRenderOwner'

describe('widget render owner', () => {
  it('resolves the provided ECS owner outside the displayed graph', () => {
    const subgraph = createTestSubgraph()
    const host = new LGraphNode('External source')
    subgraph.rootGraph.add(host)
    useCanvasStore().currentGraph = subgraph
    const Probe = defineComponent({
      setup() {
        const owner = useWidgetRenderOwner(() => host.id)
        return () => h('div', owner.value?.title)
      }
    })
    render(Probe, {
      global: {
        provide: { [WidgetRenderOwnerKey]: computed(() => host._state) }
      }
    })
    expect(screen.getByText('External source')).toBeVisible()
  })

  it('retains current-graph resolution for existing widget renderers', () => {
    const subgraph = createTestSubgraph()
    const interior = new LGraphNode('Interior owner')
    subgraph.add(interior)
    useCanvasStore().currentGraph = subgraph
    const Probe = defineComponent({
      setup() {
        const owner = useWidgetRenderOwner(() => interior.id)
        return () => h('div', owner.value?.title)
      }
    })
    render(Probe)
    expect(screen.getByText('Interior owner')).toBeVisible()
  })
})
