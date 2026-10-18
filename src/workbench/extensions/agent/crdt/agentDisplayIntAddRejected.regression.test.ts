import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { render } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toRootGraphId } from '@/types/graphScopeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { parseWireOps } from '@e2e/fixtures/agentWireFrame'
import type { WireOpEnvelope } from '@e2e/fixtures/agentWireFrame'

import { createFakeAgentSocket } from './__fixtures__/agentSocket'
import { attachDocOpMinter } from './docOpMinter'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

vi.mock(import('@/platform/telemetry/reportError'))

const DISPLAY_INT = 'Display Int (rgthree)'
const WORKFLOW_ID = 'wf-pm-2003'

const CATALOG: WidgetCatalog = {
  types: { [DISPLAY_INT]: { widget_order: [] } }
}

class DisplayIntWithClientOnlyOutputWidget extends LGraphNode {
  constructor() {
    super(DISPLAY_INT, DISPLAY_INT)
    this.addInput('input', 'INT')
    this.addWidget('text', 'output', '', () => {})
    this.serialize_widgets = true
  }
}

class DisplayIntWithoutClientWidget extends LGraphNode {
  constructor() {
    super(DISPLAY_INT, DISPLAY_INT)
    this.addInput('input', 'INT')
  }
}

function sentWireOps(raw: string): WireOpEnvelope[] {
  const frame: unknown = JSON.parse(raw)
  if (typeof frame !== 'object' || frame === null) return []
  const { type, data } = frame as { type?: unknown; data?: unknown }
  if (type !== 'doc_ops' || typeof data !== 'object' || data === null) return []
  const parsed = parseWireOps((data as { ops?: unknown }).ops)
  return parsed.ok ? parsed.ops : []
}

function toastDescriptions(): (string | undefined)[] {
  return useToast().toasts.map((toast) => toast.description)
}

function connectAgentHeldWorkflow() {
  const graph = new LGraph()
  const host = new HostDoc(WORKFLOW_ID, { nodes: [], links: [] }, CATALOG)
  const agentSocket = createFakeAgentSocket()
  const deliver = (frame: HostFrame) =>
    agentSocket.receive(frame.type, frame.data)

  let follower!: ReturnType<typeof useAgentCrdtFollower>
  const view = render(
    defineComponent({
      setup() {
        follower = useAgentCrdtFollower(ref<string | null>(WORKFLOW_ID), {
          transport: agentSocket.transport,
          getGraph: () => graph
        })
        return () => null
      }
    }),
    { global: { plugins: [getActivePinia()!] } }
  )
  onTestFinished(() => view.unmount())
  host.initialSync().forEach(deliver)

  const minter = attachDocOpMinter({
    isEnabled: () => true,
    isDocBound: () => true,
    enqueue: (operations) => follower.enqueueHumanOperations(operations),
    getGraph: () => graph,
    boundRootGraphId: () => toRootGraphId(graph.id),
    docInputNames: (nodeId) => follower.docInputNames(nodeId),
    docPromotedWidgets: (nodeId) => follower.docPromotedWidgets(nodeId),
    mayWritePromotedHost: (nodeId) => follower.mayWritePromotedHost(nodeId),
    onWidgetWriteRefused: () => follower.notifyWidgetWriteRefused()
  })
  onTestFinished(() => minter.detach())

  async function humanAdds(node: LGraphNode) {
    const framesBefore = agentSocket.send.mock.calls.length
    graph.add(node)
    await vi.waitFor(() =>
      expect(agentSocket.send.mock.calls.length).toBeGreaterThan(framesBefore)
    )
    const sent = agentSocket.send.mock.calls
      .slice(framesBefore)
      .flatMap(([frame]) => sentWireOps(frame))
    const { result, update } = host.applyWire(sent)
    deliver(result)
    if (update) deliver(update)
    return result.data
  }

  return { graph, host, humanAdds }
}

describe('PM-2003: a human adds Display Int (rgthree) while the agent holds the workflow', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
  })

  it('reproduces PM-2003: the host rejects the client-only output widget, the toast fires, and the node is removed', async () => {
    LiteGraph.registerNodeType(
      DISPLAY_INT,
      DisplayIntWithClientOnlyOutputWidget
    )
    const { graph, host, humanAdds } = connectAgentHeldWorkflow()
    const node = new DisplayIntWithClientOnlyOutputWidget()

    const verdict = await humanAdds(node)

    expect(verdict).toMatchObject({
      ok: false,
      applied: [],
      failed: {
        code: 'unknown_widget',
        message: expect.stringContaining(
          "widget 'output' is not in widget_order"
        )
      }
    })
    expect(toastDescriptions()).toEqual([
      expect.stringContaining('Your edit was rejected and was not saved')
    ])
    expect(graph.getNodeById(node.id)).toBeNull()
    expect(host.projection().nodes).toEqual([])
  })

  it.fails('keeps a node whose class carries a client-only output widget on the canvas and in the document, with no rejection toast', async () => {
    LiteGraph.registerNodeType(
      DISPLAY_INT,
      DisplayIntWithClientOnlyOutputWidget
    )
    const { graph, host, humanAdds } = connectAgentHeldWorkflow()
    const node = new DisplayIntWithClientOnlyOutputWidget()

    await humanAdds(node)

    expect({
      toasts: toastDescriptions(),
      onCanvas: graph.getNodeById(node.id)?.type,
      inDocument: host.projection().nodes.map((n) => n.type)
    }).toEqual({
      toasts: [],
      onCanvas: DISPLAY_INT,
      inDocument: [DISPLAY_INT]
    })
  })

  it('keeps the node when its class carries no client-only widget', async () => {
    LiteGraph.registerNodeType(DISPLAY_INT, DisplayIntWithoutClientWidget)
    const { graph, host, humanAdds } = connectAgentHeldWorkflow()
    const node = new DisplayIntWithoutClientWidget()

    await humanAdds(node)

    expect({
      toasts: toastDescriptions(),
      onCanvas: graph.getNodeById(node.id)?.type,
      inDocument: host.projection().nodes.map((n) => n.type)
    }).toEqual({
      toasts: [],
      onCanvas: DISPLAY_INT,
      inDocument: [DISPLAY_INT]
    })
  })
})
