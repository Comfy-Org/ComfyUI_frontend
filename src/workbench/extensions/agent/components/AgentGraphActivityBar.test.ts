import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'

import { i18n } from '@/i18n'
import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'
import { toNodeId } from '@/types/nodeId'

import AgentGraphActivityBar from './AgentGraphActivityBar.vue'
import { useAgentGraphActivityStore } from '../stores/agent/agentGraphActivityStore'

const graph = { id: 'graph-1' }
const node = {
  id: toNodeId(1),
  graph: graph as LGraph,
  pos: [10, 20],
  size: [100, 80]
} as unknown as LGraphNode
const canvas = {
  graph,
  canvas: { getBoundingClientRect: () => new DOMRect(0, 0, 800, 600) },
  animateToBounds: vi.fn()
}

vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<ComfyApp>({
    rootGraph: fromPartial<LGraph>({
      id: 'graph-1',
      getNodeById: (id: string) => (id === '1' ? node : null)
    })
  })
}))
vi.mock(import('@/utils/graphTraversalUtil'), () => ({
  getNodeByLocatorId: () => node
}))
function mount() {
  return render(AgentGraphActivityBar, {
    props: { canvas: canvas as unknown as LGraphCanvas },
    global: { plugins: [i18n] }
  })
}

describe('AgentGraphActivityBar', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div class="graph-canvas-panel" style="width: 400px"></div>'
    vi.useFakeTimers()
  })

  it('hides View nodes when the report belongs to another graph', async () => {
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: 'another-graph' },
      [toNodeId(1)]
    )
    await nextTick()

    expect(
      screen.queryByRole('button', { name: 'View node' })
    ).not.toBeInTheDocument()
    view.unmount()
  })
})
