import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyApp } from '@/scripts/app'
import { toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import { useAgentGraphActivityStore } from '../stores/agent/agentGraphActivityStore'
import AgentGraphActivityBar from './AgentGraphActivityBar.vue'

const graph = fromPartial<LGraph>({ id: 'graph-1' })
const node = fromPartial<LGraphNode>({})
Object.assign(node, {
  id: toNodeId(1),
  pos: [10, 20],
  size: [100, 80]
})
node.graph = graph
const canvas = fromPartial<LGraphCanvas>({
  graph,
  canvas: { getBoundingClientRect: () => new DOMRect(0, 0, 800, 600) },
  animateToBounds: vi.fn()
})

vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<ComfyApp>({
    rootGraph: fromPartial<LGraph>({
      id: 'graph-1',
      getNodeById: (id: string) => (id === '1' ? node : null)
    })
  })
}))
vi.mock(import('@/utils/graphTraversalUtil'))
function mount() {
  return render(AgentGraphActivityBar, {
    props: { canvas },
    global: { plugins: [i18n] }
  })
}

describe('AgentGraphActivityBar', () => {
  beforeEach(() => {
    vi.mocked(getNodeByLocatorId).mockReturnValue(node)
    document.body.innerHTML =
      '<div class="graph-canvas-panel" style="width: 400px"></div>'
    vi.useFakeTimers()
  })

  it('hides the report when it belongs to another graph', async () => {
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: toRootGraphId('another-graph') },
      [toNodeId(1)]
    )
    await nextTick()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    view.unmount()
  })
})
