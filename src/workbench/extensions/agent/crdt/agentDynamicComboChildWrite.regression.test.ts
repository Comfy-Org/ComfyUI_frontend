import { applyOps, mint, project } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { has } from 'es-toolkit/compat'
import { render } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import * as Y from 'yjs'

import {
  onGraphIntent,
  withGraphIntentSource
} from '@/lib/litegraph/src/graphIntents'
import type { GraphIntentEvent } from '@/lib/litegraph/src/graphIntents'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@comfyorg/graph-model/serialisation'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type {
  ComfyNodeDef as ComfyNodeDefV1,
  InputSpec
} from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { toRootGraphId } from '@comfyorg/graph-model/graphScopeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { parseWireOps } from '@e2e/fixtures/agentWireFrame'
import type { WireOpEnvelope } from '@e2e/fixtures/agentWireFrame'

import { createFakeAgentSocket } from './__fixtures__/agentSocket'
import { AgentCrdtProjection } from './agentCrdtProjection'
import { attachDocOpMinter } from './docOpMinter'
import { FollowerDoc } from './followerDoc'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

type LocalWidgetWrite = Extract<GraphIntentEvent, { type: 'set_widget' }>

const MODEL = 'Seedance 2.5'
const CLASS = 'TestSeedance'
const WORKFLOW_ID = 'wf-seedance'
const HOST_ACTOR = 'agent:comfy:host'
const AGENT_ACTOR = 'agent:test'

const modelSpec: InputSpec = [
  'COMFY_DYNAMICCOMBO_V3',
  {
    options: [
      {
        key: MODEL,
        inputs: {
          required: {
            prompt: ['STRING', { default: '' }],
            generate_audio: ['BOOLEAN', { default: true }],
            duration: ['INT', { default: 5, min: 4, max: 15 }]
          }
        }
      },
      {
        key: 'Seedance 2.5 Fast',
        inputs: {
          required: {
            prompt: ['STRING', { default: '' }],
            generate_audio: ['BOOLEAN', { default: true }]
          }
        }
      }
    ]
  }
]

const SEEDANCE_DEF: ComfyNodeDefV1 = {
  name: CLASS,
  display_name: 'Test Seedance',
  category: 'test',
  python_module: 'nodes',
  description: '',
  input: { required: { model: modelSpec } },
  output: ['VIDEO'],
  output_name: ['VIDEO'],
  output_is_list: [false],
  output_node: false
}

class TestSeedance extends LGraphNode {
  constructor() {
    super('Test Seedance')
    this.widgets = []
    useLitegraphService().addNodeInput(
      this,
      transformInputSpecV1ToV2(modelSpec, { name: 'model', isOptional: false })
    )
    this.addOutput('VIDEO', 'VIDEO')
    this.serialize_widgets = true
  }
}

const SELECTED_LAYOUT = [
  'model.prompt',
  'model.generate_audio',
  'model.duration'
]

const CATALOG: WidgetCatalog = {
  types: {
    [CLASS]: {
      widget_order: ['model'],
      dynamic_combos: {
        model: {
          default: MODEL,
          options: {
            [MODEL]: {
              widgets: SELECTED_LAYOUT,
              defaults: {
                'model.prompt': '',
                'model.generate_audio': true,
                'model.duration': 5
              }
            },
            'Seedance 2.5 Fast': {
              widgets: ['model.prompt', 'model.generate_audio'],
              defaults: { 'model.prompt': '', 'model.generate_audio': true }
            }
          }
        }
      }
    }
  }
}

function toWorkflowJson({ nodes, ...rest }: ISerialisedGraph): WorkflowJSON {
  return {
    ...rest,
    nodes: nodes.map(({ flags, ...node }) => ({ ...node, flags: { ...flags } }))
  }
}

function projectedValue(
  workflow: WorkflowJSON,
  nodeId: unknown,
  name: string
): unknown {
  const projected = workflow.nodes.find(
    (candidate) => String(candidate.id) === String(nodeId)
  )
  const values = projected?.widgets_values
  if (!Array.isArray(values)) return undefined
  return values[['model', ...SELECTED_LAYOUT].indexOf(name)]
}

let stamp = 1
function setWidget(node: LGraphNode, widget: string, value: unknown): Op {
  stamp++
  return {
    op: 'set_widget',
    op_id: `${AGENT_ACTOR}-${widget}-${stamp}`,
    actor: AGENT_ACTOR,
    base_version: 1,
    stamp: [stamp, AGENT_ACTOR],
    node_id: node.id,
    widget,
    value
  }
}

function createWorkflowGraph() {
  const graph = new LGraph()
  const node = withGraphIntentSource('load', () => {
    const created = LiteGraph.createNode(CLASS)
    if (!created) throw new Error(`${CLASS} not registered`)
    graph.add(created)
    return created
  })
  const widget = (name: string) => {
    const found = node.widgets?.find((candidate) => candidate.name === name)
    if (!found) throw new Error(`no widget ${name}`)
    return found
  }
  withGraphIntentSource('load', () => {
    widget('model').value = MODEL
    widget('model.prompt').value = 'a singer on stage'
  })
  return { graph, node, widget }
}

function setup() {
  const { graph, node, widget } = createWorkflowGraph()

  const host = mint(toWorkflowJson(structuredClone(graph.serialize())), CATALOG)
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => graph)
  let seq = 0
  const deliver = (update: Uint8Array) => {
    follower.applyRemoteUpdate(update)
    projection.applyFrame({
      workflowId: WORKFLOW_ID,
      seq: ++seq,
      update,
      actor: HOST_ACTOR,
      opIds: []
    })
  }
  projection.bind(WORKFLOW_ID, follower)
  deliver(Y.encodeStateAsUpdate(host))

  const hostApplies = (ops: Op[]) => {
    const before = Y.encodeStateVector(host)
    const { outcomes } = applyOps(host, ops, CATALOG)
    expect(outcomes.map((outcome) => outcome.outcome)).toEqual(
      ops.map(() => 'applied')
    )
    deliver(Y.encodeStateAsUpdate(host, before))
  }
  const hostPositionalValue = (name: string) =>
    projectedValue(project(host, CATALOG), node.id, name)

  const localWrites: LocalWidgetWrite[] = []
  const stop = onGraphIntent((event) => {
    if (event.source === 'local' && event.type === 'set_widget')
      localWrites.push(event)
  })
  const destroy = () => {
    stop()
    projection.destroy()
    follower.destroy()
    host.destroy()
  }
  onTestFinished(destroy)
  return { graph, node, widget, hostApplies, hostPositionalValue, localWrites }
}

function sentWireOps(raw: string): WireOpEnvelope[] {
  const frame: unknown = JSON.parse(raw)
  if (!has(frame, 'type')) return []
  if (frame.type !== 'doc_ops') return []
  if (!has(frame, 'data')) return []
  const { data } = frame
  if (!has(data, 'ops')) return []
  const parsed = parseWireOps(data.ops)
  return parsed.ok ? parsed.ops : []
}

function connectMintedWorkflow() {
  const { graph, node, widget } = createWorkflowGraph()

  const host = new HostDoc(
    WORKFLOW_ID,
    toWorkflowJson(structuredClone(graph.serialize())),
    CATALOG
  )
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
    docWidgetValue: (nodeId, widgetName) =>
      follower.docWidgetValue(nodeId, widgetName),
    docPromotedWidgets: (nodeId) => follower.docPromotedWidgets(nodeId),
    mayWritePromotedHost: (nodeId) => follower.mayWritePromotedHost(nodeId),
    docHasSubgraphDefinition: (definitionId) =>
      follower.docHasSubgraphDefinition(definitionId),
    onWidgetWriteRefused: (nodeId, widgetName) =>
      follower.notifyWidgetWriteRefused(nodeId, widgetName)
  })
  onTestFinished(() => minter.detach())

  const agentWrites = (widgetName: string, value: unknown) =>
    deliver(
      host.apply([
        { op: 'set_widget', node_id: node.id, widget: widgetName, value }
      ])
    )

  async function personEdits(edit: () => void): Promise<WireOpEnvelope[]> {
    const before = agentSocket.send.mock.calls.length
    edit()
    await vi.waitFor(() =>
      expect(agentSocket.send.mock.calls.length).toBeGreaterThan(before)
    )
    const sent = agentSocket.send.mock.calls
      .slice(before)
      .flatMap(([frame]) => sentWireOps(frame))
    const { result, update } = host.applyWire(sent)
    deliver(result)
    if (update) deliver(update)
    return sent
  }

  const hostValue = (name: string) =>
    projectedValue(host.projection(), node.id, name)

  return { widget, agentWrites, personEdits, hostValue }
}

function mintedValuesFor(
  sent: WireOpEnvelope[],
  widgetName: string
): unknown[] {
  return sent.flatMap((op) =>
    op.op === 'set_widget' &&
    'widget' in op &&
    op.widget === widgetName &&
    'value' in op
      ? [op.value]
      : []
  )
}

beforeEach(() => {
  LiteGraph.registerNodeType(CLASS, TestSeedance)
})

describe('an Agent write to a dynamic-combo child (PM-2326)', () => {
  it('lands on the live child widget', () => {
    const s = setup()
    expect(s.widget('model.generate_audio').value).toBe(true)

    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])

    expect(s.widget('model.generate_audio').value).toBe(false)
    expect(s.localWrites).toEqual([])
  })

  it('survives a later Agent write to a sibling child', () => {
    const s = setup()
    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])

    s.hostApplies([setWidget(s.node, 'model.prompt', 'a new prompt')])

    expect(s.widget('model.generate_audio').value).toBe(false)
    expect(s.hostPositionalValue('model.generate_audio')).toBe(false)
  })

  it('survives the person editing a sibling child', () => {
    const s = setup()
    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])

    s.widget('model.prompt').value = 'typed by the person'

    expect(s.widget('model.generate_audio').value).toBe(false)
    expect(
      s.localWrites.filter((write) => write.name === 'model.generate_audio')
    ).toEqual([])
  })

  it('survives the person re-selecting the same model', () => {
    const s = setup()
    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])

    s.widget('model').value = MODEL

    expect(s.widget('model.generate_audio').value).toBe(false)
    expect(
      s.localWrites
        .filter((write) => write.name === 'model.generate_audio')
        .map((write) => write.value)
    ).not.toContain(true)
  })

  it('survives the person switching the model away and back', () => {
    const s = setup()
    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])

    s.widget('model').value = 'Seedance 2.5 Fast'
    s.widget('model').value = MODEL

    expect(s.widget('model.generate_audio').value).toBe(false)
    expect(
      s.localWrites
        .filter((write) => write.name === 'model.generate_audio')
        .map((write) => write.value)
    ).not.toContain(true)
  })

  it('survives an Agent write that re-selects the same model', () => {
    const s = setup()
    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])

    s.hostApplies([setWidget(s.node, 'model', MODEL)])

    expect(s.widget('model.generate_audio').value).toBe(false)
    expect(s.hostPositionalValue('model.generate_audio')).toBe(false)
    expect(s.localWrites).toEqual([])
  })

  describe('when the person edit travels through the real minter', () => {
    beforeEach(() => {
      useAgentPanelStore().enabled = true
      useNodeDefStore().addNodeDef(SEEDANCE_DEF)
    })

    it('mints the sibling edit and leaves the Agent value alone on the wire', async () => {
      const s = connectMintedWorkflow()
      s.agentWrites('model.generate_audio', false)
      await vi.waitFor(() =>
        expect(s.widget('model.generate_audio').value).toBe(false)
      )

      const sent = await s.personEdits(() => {
        s.widget('model.prompt').value = 'typed by the person'
      })

      expect(mintedValuesFor(sent, 'model.prompt')).toEqual([
        'typed by the person'
      ])
      expect(mintedValuesFor(sent, 'model.generate_audio')).toEqual([])
      expect(s.hostValue('model.prompt')).toBe('typed by the person')
      expect(s.hostValue('model.generate_audio')).toBe(false)
      expect(s.widget('model.generate_audio').value).toBe(false)
    })

    it('never mints the catalog default back when the rebuild runs first', async () => {
      const s = connectMintedWorkflow()
      s.agentWrites('model.generate_audio', false)
      await vi.waitFor(() =>
        expect(s.widget('model.generate_audio').value).toBe(false)
      )

      const sent = await s.personEdits(() => {
        s.widget('model').value = MODEL
        s.widget('model.prompt').value = 'typed after the rebuild'
      })

      expect(mintedValuesFor(sent, 'model.prompt').at(-1)).toBe(
        'typed after the rebuild'
      )
      expect(s.hostValue('model.prompt')).toBe('typed after the rebuild')
      expect(mintedValuesFor(sent, 'model.generate_audio')).not.toContain(true)
      expect(s.hostValue('model.generate_audio')).toBe(false)
      expect(s.widget('model.generate_audio').value).toBe(false)
    })
  })

  it('serializes the Agent value for the next queued run', () => {
    const s = setup()
    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])
    s.widget('model.prompt').value = 'typed by the person'

    const saved = s.node.serialize()
    expect(saved.widgets_values).toEqual([
      MODEL,
      'typed by the person',
      false,
      5
    ])
  })
})
