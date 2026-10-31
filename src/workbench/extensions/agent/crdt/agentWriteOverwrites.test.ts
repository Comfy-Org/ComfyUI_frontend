import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import {
  emitGraphIntent,
  onGraphIntent,
  withGraphIntentSource
} from '@/lib/litegraph/src/graphIntents'
import type {
  GraphIntentEvent,
  GraphIntentSource
} from '@/lib/litegraph/src/graphIntents'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@comfyorg/graph-model/serialisation'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { reportError } from '@comfyorg/telemetry/reportError'

import { AgentCrdtProjection } from './agentCrdtProjection'
import {
  attachAgentWriteOverwriteWatch,
  describeWidgetValue
} from './agentWriteOverwrites'
import { setCrdtDebugEnabled } from './crdtDebugGate'
import { clearDevEvents, devEvents } from './devPanelLog'
import type { DevEvent } from './devPanelLog'
import { FollowerDoc } from './followerDoc'

vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: vi.fn(),
  markErrorReported: vi.fn(),
  configureErrorReporter: vi.fn(),
  flushPendingReports: vi.fn()
}))

const MODEL = 'Seedance 2.5'
const CLASS = 'TestSeedanceOverwrite'
const WORKFLOW_ID = 'wf-seedance-overwrite'
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
      }
    ]
  }
]

class TestSeedance extends LGraphNode {
  constructor() {
    super('Test Seedance Overwrite')
    this.widgets = []
    useLitegraphService().addNodeInput(
      this,
      transformInputSpecV1ToV2(modelSpec, { name: 'model', isOptional: false })
    )
    this.addOutput('VIDEO', 'VIDEO')
    this.serialize_widgets = true
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    [CLASS]: {
      widget_order: ['model'],
      dynamic_combos: {
        model: {
          default: MODEL,
          options: {
            [MODEL]: {
              widgets: [
                'model.prompt',
                'model.generate_audio',
                'model.duration'
              ],
              defaults: {
                'model.prompt': '',
                'model.generate_audio': true,
                'model.duration': 5
              }
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
function agentSetWidget(node: LGraphNode, widget: string, value: unknown): Op {
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

function overwriteEvents(): DevEvent[] {
  return devEvents.value.filter(
    (event) => event.kind === 'agent_write_overwritten'
  )
}

function overwriteDetails(): Record<string, unknown>[] {
  return overwriteEvents().map(
    (event) => event.detail as Record<string, unknown>
  )
}

interface FrameProvenance {
  actor?: string
  catchUp?: boolean
}

function setup({ enabled = true }: { enabled?: boolean } = {}) {
  let gateOpen = enabled
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
  })

  const host = mint(toWorkflowJson(structuredClone(graph.serialize())), CATALOG)
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => graph)
  let seq = 0
  const deliver = (update: Uint8Array, provenance: FrameProvenance = {}) => {
    follower.applyRemoteUpdate(update)
    projection.applyFrame({
      workflowId: WORKFLOW_ID,
      seq: ++seq,
      update,
      actor: provenance.actor ?? AGENT_ACTOR,
      opIds: [],
      catchUp: provenance.catchUp ?? false
    })
  }
  projection.bind(WORKFLOW_ID, follower)
  // The first frame is the host's baseline, which is a catch-up sync rather
  // than a turn's writes.
  deliver(Y.encodeStateAsUpdate(host), { actor: HOST_ACTOR, catchUp: true })

  const sourcesOf = new Map<string, GraphIntentSource[]>()
  const stopRecording = onGraphIntent((event: GraphIntentEvent) => {
    if (event.type !== 'set_widget') return
    const seen = sourcesOf.get(event.name) ?? []
    seen.push(event.source)
    sourcesOf.set(event.name, seen)
  })

  let isRestoringState = false
  const watch = attachAgentWriteOverwriteWatch({
    isEnabled: () => gateOpen,
    isRestoringState: () => isRestoringState
  })

  onTestFinished(() => {
    watch.detach()
    stopRecording()
    projection.destroy()
    follower.destroy()
    host.destroy()
  })

  const remoteWrites = (
    widgetName: string,
    value: unknown,
    provenance: FrameProvenance = {}
  ) => {
    const before = Y.encodeStateVector(host)
    const { outcomes } = applyOps(
      host,
      [agentSetWidget(node, widgetName, value)],
      CATALOG
    )
    expect(outcomes.map((outcome) => outcome.outcome)).toEqual(['applied'])
    deliver(Y.encodeStateAsUpdate(host, before), provenance)
  }
  const agentWrites = (widgetName: string, value: unknown) =>
    remoteWrites(widgetName, value)

  const edits = (
    source: GraphIntentSource,
    edit: () => void,
    { restoring = false }: { restoring?: boolean } = {}
  ) => {
    isRestoringState = restoring
    try {
      withGraphIntentSource(source, edit)
    } finally {
      isRestoringState = false
    }
  }

  return {
    graph,
    node,
    widget,
    agentWrites,
    remoteWrites,
    edits,
    setGateOpen: (open: boolean) => {
      gateOpen = open
    },
    sourcesFor: (name: string) => sourcesOf.get(name) ?? [],
    nodeId: String(node.id)
  }
}

beforeEach(() => {
  LiteGraph.registerNodeType(CLASS, TestSeedance)
  setCrdtDebugEnabled(true)
  clearDevEvents()
  onTestFinished(() => {
    clearDevEvents()
  })
})

describe('describeWidgetValue', () => {
  it.for([
    { value: false, shape: { type: 'boolean', literal: false } },
    { value: true, shape: { type: 'boolean', literal: true } },
    { value: 5, shape: { type: 'number', literal: 5 } },
    { value: null, shape: { type: 'null' } },
    { value: undefined, shape: { type: 'undefined' } },
    { value: [1, 2, 3], shape: { type: 'array', length: 3 } },
    { value: { a: 1 }, shape: { type: 'object', length: 1 } }
  ])('describes $value structurally', ({ value, shape }) => {
    expect(describeWidgetValue(value)).toEqual(shape)
  })

  it('keeps a string by length only, never its text', () => {
    const prompt = 'a singer on stage, sensitive user prose'
    expect(describeWidgetValue(prompt)).toEqual({
      type: 'string',
      length: prompt.length
    })
    expect(JSON.stringify(describeWidgetValue(prompt))).not.toContain('singer')
  })
})

describe('recording which edit overwrote an Agent write (PM-2379)', () => {
  it('names a canvas edit that changed the value the Agent wrote', () => {
    const s = setup()
    s.agentWrites('model.generate_audio', false)
    expect(s.widget('model.generate_audio').value).toBe(false)

    s.edits('local', () => {
      s.widget('model.generate_audio').value = true
    })

    expect(overwriteEvents()).toHaveLength(1)
    expect(overwriteEvents()[0]).toMatchObject({
      kind: 'agent_write_overwritten',
      level: 'warn'
    })
    expect(overwriteDetails()[0]).toMatchObject({
      kind: 'canvas-edit',
      node_id: s.nodeId,
      name: 'model.generate_audio',
      agent_value: { type: 'boolean', literal: false },
      new_value: { type: 'boolean', literal: true }
    })
  })

  it('leaves the overwriting edit standing: the watch reads, never writes', () => {
    const s = setup()
    s.agentWrites('model.generate_audio', false)

    s.edits('local', () => {
      s.widget('model.generate_audio').value = true
    })

    expect(s.widget('model.generate_audio').value).toBe(true)
  })

  it('records nothing for the Agent’s own write', () => {
    const s = setup()

    s.agentWrites('model.generate_audio', false)

    const sources = s.sourcesFor('model.generate_audio')
    expect(sources.length).toBeGreaterThan(0)
    expect(new Set(sources)).toEqual(new Set(['agent-remote']))
    expect(overwriteEvents()).toEqual([])
  })

  it('records nothing when the Agent overwrites its own earlier write', () => {
    const s = setup()
    s.agentWrites('model.generate_audio', false)

    s.agentWrites('model.generate_audio', true)

    expect(overwriteEvents()).toEqual([])
  })

  it('records nothing for a register the Agent never wrote', () => {
    const s = setup()

    s.edits('local', () => {
      s.widget('model.generate_audio').value = false
    })

    expect(overwriteEvents()).toEqual([])
  })

  it('names an undo/redo replay as the edit responsible', () => {
    const s = setup()
    s.agentWrites('model.generate_audio', false)

    s.edits(
      'load',
      () => {
        s.widget('model.generate_audio').value = true
      },
      { restoring: true }
    )

    expect(overwriteDetails()).toHaveLength(1)
    expect(overwriteDetails()[0]).toMatchObject({ kind: 'undo-redo-restore' })
  })

  it('names an ordinary graph load separately from an undo/redo replay', () => {
    const s = setup()
    s.agentWrites('model.generate_audio', false)

    s.edits('load', () => {
      s.widget('model.generate_audio').value = true
    })

    expect(overwriteDetails()).toHaveLength(1)
    expect(overwriteDetails()[0]).toMatchObject({ kind: 'graph-load' })
  })

  it('re-arms on each Agent write, so a repeated revert reads as repeated records', () => {
    const s = setup()

    s.agentWrites('model.generate_audio', false)
    s.edits('local', () => {
      s.widget('model.generate_audio').value = true
    })
    s.agentWrites('model.generate_audio', false)
    s.edits('local', () => {
      s.widget('model.generate_audio').value = true
    })

    expect(overwriteDetails().map((detail) => detail.kind)).toEqual([
      'canvas-edit',
      'canvas-edit'
    ])
  })

  it('keeps a free-form value out of the record', () => {
    const s = setup()
    s.agentWrites('model.prompt', 'the Agent wrote this prompt')

    s.edits('local', () => {
      s.widget('model.prompt').value = 'the person typed over it'
    })

    expect(overwriteDetails()[0]).toMatchObject({
      name: 'model.prompt',
      agent_value: { type: 'string', length: 27 },
      new_value: { type: 'string', length: 24 }
    })
    const serialized = JSON.stringify(overwriteEvents())
    expect(serialized).not.toContain('Agent wrote this prompt')
    expect(serialized).not.toContain('person typed over it')
  })

  it('reports to telemetry as well, because production buffers nothing', () => {
    const s = setup()
    s.agentWrites('model.generate_audio', false)

    s.edits('local', () => {
      s.widget('model.generate_audio').value = true
    })

    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        surface: 'agent',
        errorType: 'agent_write_overwritten',
        level: 'warning',
        tags: expect.objectContaining({
          overwrite_kind: 'canvas-edit',
          widget: 'model.generate_audio'
        })
      })
    )
  })

  it('records nothing while the product gate is off', () => {
    const s = setup({ enabled: false })
    s.agentWrites('model.generate_audio', false)

    s.edits('local', () => {
      s.widget('model.generate_audio').value = true
    })

    expect(overwriteEvents()).toEqual([])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('ignores a catch-up frame: it is a sync, not a turn the Agent took', () => {
    const s = setup()
    s.remoteWrites('model.generate_audio', false, { catchUp: true })

    s.edits('local', () => {
      s.widget('model.generate_audio').value = true
    })

    expect(overwriteEvents()).toEqual([])
  })

  it('ignores a frame another tab’s person authored', () => {
    const s = setup()
    s.remoteWrites('model.generate_audio', false, {
      actor: 'human:someone-else:tab2'
    })

    s.edits('local', () => {
      s.widget('model.generate_audio').value = true
    })

    expect(overwriteEvents()).toEqual([])
  })

  it('forgets an Agent write a later non-Agent frame replaced', () => {
    const s = setup()
    s.agentWrites('model.generate_audio', false)

    s.remoteWrites('model.generate_audio', true, { catchUp: true })
    s.edits('local', () => {
      s.widget('model.generate_audio').value = false
    })

    expect(overwriteEvents()).toEqual([])
  })

  it('names an automatic write during a restore as the replay, not the person', () => {
    const s = setup()
    s.agentWrites('model.generate_audio', false)

    // `local` is the default source for anything outside an explicit scope,
    // so a normalization watcher or `afterConfigureGraph` hook running under
    // a restore arrives as `local`.
    s.edits(
      'local',
      () => {
        s.widget('model.generate_audio').value = true
      },
      { restoring: true }
    )

    expect(overwriteDetails()).toHaveLength(1)
    expect(overwriteDetails()[0]).toMatchObject({ kind: 'undo-redo-restore' })
  })

  it('forgets a removed node whatever removed it, not only a local delete', () => {
    const s = setup()
    s.agentWrites('model.generate_audio', false)

    // An Agent delete and `configure({ clearGraph: true })` are not `local`.
    // Node ids are reused, so an entry kept past the removal is charged to
    // whoever next occupies that id and widget name.
    withGraphIntentSource('agent-remote', () => {
      s.graph.remove(s.node)
    })
    withGraphIntentSource('load', () => {
      s.graph.add(s.node)
    })

    s.edits('local', () => {
      s.widget('model.generate_audio').value = true
    })

    expect(overwriteEvents()).toEqual([])
  })

  it('keys a removal by the root graph, not the subgraph holding the node', () => {
    const s = setup()
    s.agentWrites('model.generate_audio', false)

    // Widget registers are keyed by the root graph id, while a `remove_node`
    // carries the graph that held the node — a subgraph for an interior one.
    // Keying the removal by that graph's own id would never match.
    emitGraphIntent({
      type: 'remove_node',
      graph: {
        id: 'some-interior-subgraph',
        rootGraph: s.graph
      } as unknown as LGraph,
      node: s.node,
      removedLinkIds: []
    })

    s.edits('local', () => {
      s.widget('model.generate_audio').value = true
    })

    expect(overwriteEvents()).toEqual([])
  })

  it('drops what it remembered while the gate was closed', () => {
    const s = setup()
    s.agentWrites('model.duration', 9)

    // The edit made while the gate was closed is the one that overwrote the
    // Agent's value, and it is invisible. Comparing the next edit against the
    // Agent's stale value would blame it for an overwrite it did not make,
    // with a `ms_since_agent_write` spanning the whole closed window.
    s.setGateOpen(false)
    s.edits('local', () => {
      s.widget('model.duration').value = 7
    })
    s.setGateOpen(true)
    s.edits('local', () => {
      s.widget('model.duration').value = 6
    })

    expect(overwriteEvents()).toEqual([])
  })

  it('caps telemetry reports per session, but keeps recording locally', () => {
    const s = setup()
    const cycles = 40

    for (let index = 0; index < cycles; index++) {
      s.agentWrites('model.generate_audio', false)
      s.edits('local', () => {
        s.widget('model.generate_audio').value = true
      })
    }

    expect(overwriteEvents()).toHaveLength(cycles)
    const reports = vi
      .mocked(reportError)
      .mock.calls.filter(
        ([, context]) =>
          (context as { errorType?: string } | undefined)?.errorType ===
          'agent_write_overwritten'
      )
    expect(reports).toHaveLength(32)
  })

  it('stops recording once detached', () => {
    const s = setup()
    const extra = attachAgentWriteOverwriteWatch({
      isEnabled: () => true,
      isRestoringState: () => false
    })
    s.agentWrites('model.generate_audio', false)
    extra.detach()

    s.edits('local', () => {
      s.widget('model.generate_audio').value = true
    })

    expect(overwriteEvents()).toHaveLength(1)
  })
})
