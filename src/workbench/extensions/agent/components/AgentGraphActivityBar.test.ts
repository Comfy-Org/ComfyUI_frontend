import { markRaw, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'

import { i18n } from '@/i18n'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type { ComfyApp } from '@/scripts/app'
import { toRootGraphId } from '@comfyorg/graph-model/graphScopeId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import AgentGraphActivityBar from './AgentGraphActivityBar.vue'
import { useAgentGraphActivityStore } from '@/workbench/extensions/agent/stores/agent/agentGraphActivityStore'

const node = fromPartial<LGraphNode>({})
Object.assign(node, {
  id: toNodeId(1),
  pos: [10, 20],
  size: [100, 80]
})
const graph = fromPartial<LGraph>({ id: 'graph-1', nodes: [node] })
// markRaw: without it the props proxy hands the component a reactive wrapper
// of `graph`, and the component's `node.graph === canvas.graph` reference
// check — which holds in the app, where the canvas is not reactive state —
// would be false for a reason that has nothing to do with the behaviour.
const canvas = markRaw(
  fromPartial<LGraphCanvas>({
    graph,
    canvas: { getBoundingClientRect: () => new DOMRect(0, 0, 800, 600) },
    ds: fromPartial<LGraphCanvas['ds']>({
      visible_area: new Rectangle(0, 0, 800, 600)
    }),
    animateToBounds: vi.fn()
  })
)
node.graph = canvas.graph

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
    vi.mocked(canvas.animateToBounds).mockClear()
    node.pos = [10, 20]
  })

  // ADR-AGENT-VIEWPORT-0062. The nodes land where the template says; the
  // camera is what adapts.
  it('frames the batch once when the whole canvas is the batch and it is off screen', async () => {
    node.pos = [7000, 6500]
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: toRootGraphId('graph-1') },
      [toNodeId(1)]
    )
    await nextTick()

    expect(canvas.animateToBounds).toHaveBeenCalledTimes(1)

    // A second materialization in the same turn must not drag the camera again.
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: toRootGraphId('graph-1') },
      [toNodeId(1)]
    )
    await nextTick()
    expect(canvas.animateToBounds).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('leaves the camera alone when the batch is already on screen', async () => {
    const view = mount()
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: toRootGraphId('graph-1') },
      [toNodeId(1)]
    )
    await nextTick()

    expect(canvas.animateToBounds).not.toHaveBeenCalled()
    view.unmount()
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
