import { applyOps, mint, project } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import {
  onGraphIntent,
  withGraphIntentSource
} from '@/lib/litegraph/src/graphIntents'
import type { GraphIntentEvent } from '@/lib/litegraph/src/graphIntents'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import { useLitegraphService } from '@/services/litegraphService'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'

/**
 * PM-2326: a user reported that the Agent "had trouble making" Seedance's
 * no-audio setting stick. The setting is `model.generate_audio`, a child of
 * the `model` dynamic combo. These cases pin that an Agent write to such a
 * child survives the edits a person makes on the same node afterwards.
 */
type LocalWidgetWrite = Extract<GraphIntentEvent, { type: 'set_widget' }>

const MODEL = 'Seedance 2.5'
const CLASS = 'TestSeedance'
const WORKFLOW_ID = 'wf-seedance'
const HOST_ACTOR = 'agent:comfy:host'
const AGENT_ACTOR = 'agent:test'

const modelSpec = [
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
] as const

class TestSeedance extends LGraphNode {
  constructor() {
    super('Test Seedance')
    this.widgets = []
    useLitegraphService().addNodeInput(
      this,
      transformInputSpecV1ToV2(
        modelSpec as unknown as Parameters<typeof transformInputSpecV1ToV2>[0],
        { name: 'model', isOptional: false }
      )
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

let stamp = 1
function setWidget(
  node: LGraphNode,
  widget: string,
  value: unknown,
  actor = AGENT_ACTOR
): Op {
  stamp++
  return {
    op: 'set_widget',
    op_id: `${actor}-${widget}-${stamp}`,
    actor,
    base_version: 1,
    stamp: [stamp, actor],
    node_id: node.id,
    widget,
    value
  }
}

function setup() {
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
  /** The host's projected value, positional in the selected layout. */
  const hostValue = (name: string) => {
    const projected = project(host, CATALOG).nodes.find(
      (candidate) => String(candidate.id) === String(node.id)
    )
    const order = ['model', ...SELECTED_LAYOUT]
    const values = projected?.widgets_values
    if (!Array.isArray(values)) return undefined
    return values[order.indexOf(name)]
  }

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
  return { graph, node, widget, hostApplies, hostValue, localWrites, destroy }
}

let cleanup: (() => void) | undefined
beforeEach(() => {
  LiteGraph.registerNodeType(CLASS, TestSeedance)
})
afterEach(() => {
  cleanup?.()
  cleanup = undefined
})

describe('an Agent write to a dynamic-combo child (PM-2326)', () => {
  it('lands on the live child widget', () => {
    const s = setup()
    cleanup = s.destroy
    expect(s.widget('model.generate_audio').value).toBe(true)

    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])

    expect(s.widget('model.generate_audio').value).toBe(false)
    expect(s.localWrites).toEqual([])
  })

  it('survives a later Agent write to a sibling child', () => {
    const s = setup()
    cleanup = s.destroy
    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])

    s.hostApplies([setWidget(s.node, 'model.prompt', 'a new prompt')])

    expect(s.widget('model.generate_audio').value).toBe(false)
    expect(s.hostValue('model.generate_audio')).toBe(false)
  })

  it('survives the person editing a sibling child', () => {
    const s = setup()
    cleanup = s.destroy
    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])

    s.widget('model.prompt').value = 'typed by the person'

    expect(s.widget('model.generate_audio').value).toBe(false)
    expect(
      s.localWrites.filter((write) => write.name === 'model.generate_audio')
    ).toEqual([])
  })

  it('survives the person re-selecting the same model', () => {
    const s = setup()
    cleanup = s.destroy
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
    cleanup = s.destroy
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
    cleanup = s.destroy
    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])

    s.hostApplies([setWidget(s.node, 'model', MODEL)])

    expect(s.widget('model.generate_audio').value).toBe(false)
    expect(s.hostValue('model.generate_audio')).toBe(false)
    expect(s.localWrites).toEqual([])
  })

  it('serializes the Agent value for the next queued run', () => {
    const s = setup()
    cleanup = s.destroy
    s.hostApplies([setWidget(s.node, 'model.generate_audio', false)])
    s.widget('model.prompt').value = 'typed by the person'

    const saved = s.node.serialize()
    const names = (s.node.widgets ?? [])
      .filter((widget) => widget.serialize !== false)
      .map((widget) => widget.name)
    const values = saved.widgets_values as unknown[]
    expect(values[names.indexOf('model.generate_audio')]).toBe(false)
  })
})
