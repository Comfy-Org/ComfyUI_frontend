import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { render } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'
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

const DISPLAY_INT_DEF: ComfyNodeDefV1 = {
  name: DISPLAY_INT,
  display_name: DISPLAY_INT,
  category: 'rgthree',
  python_module: 'custom_nodes.rgthree-comfy',
  description: '',
  input: { required: { input: ['INT', { forceInput: true }] } },
  output: [],
  output_name: [],
  output_is_list: [],
  output_node: true
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
    docHasSubgraphDefinition: (definitionId) =>
      follower.docHasSubgraphDefinition(definitionId),
    onWidgetWriteRefused: (nodeId, widgetName) =>
      follower.notifyWidgetWriteRefused(nodeId, widgetName)
  })
  onTestFinished(() => minter.detach())

  async function humanAdds(node: LGraphNode) {
    const sent = await humanSends(node)
    const { result, update } = host.applyWire(sent)
    deliver(result)
    if (update) deliver(update)
    return { sent, verdict: result.data }
  }

  async function humanSends(node: LGraphNode) {
    const framesBefore = agentSocket.send.mock.calls.length
    graph.add(node)
    await vi.waitFor(() =>
      expect(agentSocket.send.mock.calls.length).toBeGreaterThan(framesBefore)
    )
    return agentSocket.send.mock.calls
      .slice(framesBefore)
      .flatMap(([frame]) => sentWireOps(frame))
  }

  return { graph, host, deliver, humanAdds }
}

function openInAnotherTab(host: HostDoc) {
  const graph = new LGraph()
  const agentSocket = createFakeAgentSocket()
  const view = render(
    defineComponent({
      setup() {
        useAgentCrdtFollower(ref<string | null>(WORKFLOW_ID), {
          transport: agentSocket.transport,
          getGraph: () => graph
        })
        return () => null
      }
    }),
    { global: { plugins: [getActivePinia()!] } }
  )
  onTestFinished(() => view.unmount())
  host
    .initialSync()
    .forEach((frame) => agentSocket.receive(frame.type, frame.data))
  return graph
}

describe('PM-2003: a human adds Display Int (rgthree) while the agent holds the workflow', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
    useNodeDefStore().addNodeDef(DISPLAY_INT_DEF)
  })

  it('sends the node with its own widget form, because the catalog cannot describe the client-only output widget', async () => {
    LiteGraph.registerNodeType(
      DISPLAY_INT,
      DisplayIntWithClientOnlyOutputWidget
    )
    const { humanAdds } = connectAgentHeldWorkflow()

    const { sent } = await humanAdds(new DisplayIntWithClientOnlyOutputWidget())

    expect(sent).toEqual([
      expect.objectContaining({
        op: 'add_node',
        node: expect.objectContaining({
          widgets_values: { output: '' },
          widgets_values_form: { order: ['output'] }
        })
      })
    ])
  })

  it('keeps a node whose class carries a client-only output widget on the canvas and in the document, with no rejection toast', async () => {
    LiteGraph.registerNodeType(
      DISPLAY_INT,
      DisplayIntWithClientOnlyOutputWidget
    )
    const { graph, host, humanAdds } = connectAgentHeldWorkflow()
    const node = new DisplayIntWithClientOnlyOutputWidget()

    const { verdict } = await humanAdds(node)

    expect(verdict).toMatchObject({ ok: true })
    expect({
      toasts: toastDescriptions(),
      onCanvas: graph.getNodeById(node.id)?.type,
      inDocument: host.projection().nodes.map((n) => ({
        type: n.type,
        widgets_values: n.widgets_values
      }))
    }).toEqual({
      toasts: [],
      onCanvas: DISPLAY_INT,
      inDocument: [{ type: DISPLAY_INT, widgets_values: { output: '' } }]
    })
  })

  it('lands an agent write to the declared widget on the canvas', async () => {
    LiteGraph.registerNodeType(
      DISPLAY_INT,
      DisplayIntWithClientOnlyOutputWidget
    )
    const { graph, host, deliver, humanAdds } = connectAgentHeldWorkflow()
    const node = new DisplayIntWithClientOnlyOutputWidget()
    await humanAdds(node)

    deliver(
      host.apply([
        { op: 'set_widget', node_id: node.id, widget: 'output', value: '42' }
      ])
    )

    await vi.waitFor(() =>
      expect(
        graph.getNodeById(node.id)?.widgets?.find((w) => w.name === 'output')
          ?.value
      ).toBe('42')
    )
  })

  it('opens the declared node in another tab without leaking the document-internal form onto it', async () => {
    LiteGraph.registerNodeType(
      DISPLAY_INT,
      DisplayIntWithClientOnlyOutputWidget
    )
    const { host, humanAdds } = connectAgentHeldWorkflow()
    const node = new DisplayIntWithClientOnlyOutputWidget()
    await humanAdds(node)
    host.apply([
      { op: 'set_widget', node_id: node.id, widget: 'output', value: '42' }
    ])

    const otherTab = openInAnotherTab(host)

    await vi.waitFor(() =>
      expect(otherTab.getNodeById(node.id)?.type).toBe(DISPLAY_INT)
    )
    const reopened = otherTab.getNodeById(node.id)!
    expect(reopened.widgets?.find((w) => w.name === 'output')?.value).toBe('42')
    expect(reopened).not.toHaveProperty('__widgets_form')
    expect(reopened.serialize()).not.toHaveProperty('__widgets_form')
  })

  it('keeps the catalog path, with no form, when the definition describes every widget', async () => {
    LiteGraph.registerNodeType(DISPLAY_INT, DisplayIntWithoutClientWidget)
    const { graph, host, humanAdds } = connectAgentHeldWorkflow()
    const node = new DisplayIntWithoutClientWidget()

    const { sent } = await humanAdds(node)

    expect(sent).toEqual([
      expect.objectContaining({
        op: 'add_node',
        node: expect.not.objectContaining({
          widgets_values_form: expect.anything()
        })
      })
    ])
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
