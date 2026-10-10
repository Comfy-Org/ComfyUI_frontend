/**
 * A human op's stamp counter is a Lamport tick over the follower doc: one
 * above the highest stamp the doc already holds, and above every counter this
 * tab minted that the host has not echoed back yet. The host sequence is an
 * admission number and must not feed stamps.
 */
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { applyOps, mint, readGraph } from '@comfyorg/comfy-multi-player'
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { reportError } from '@/platform/telemetry/reportError'

import type { DocOp } from './docFrameClient'
import { FollowerDoc } from './followerDoc'
import type { GraphOperation } from './graphOperations'
import { mintWireOps } from './opEnvelope'
import { createOpSender } from './opSender'

vi.mock(import('@/platform/telemetry/reportError'))

const WORKFLOW_ID = 'wf-1'
const HUMAN = 'human:test-user:tab-1'
const AGENT = 'agent:test'

const CATALOG: WidgetCatalog = {
  types: {
    KSampler: { widget_order: ['seed', 'steps'] },
    TestImageList: { widget_order: [] },
    TestImageSource: { widget_order: [] }
  }
}

const WORKFLOW: WorkflowJSON = {
  nodes: [
    {
      id: 'B',
      type: 'KSampler',
      pos: [0, 0],
      widgets_values: [1, 20],
      inputs: [],
      outputs: []
    }
  ],
  links: []
}

const setSteps = (value: number): GraphOperation => ({
  op: 'set_widget',
  node_id: 'B',
  widget: 'steps',
  value
})

function agentWrite(host: Y.Doc, operation: GraphOperation, counter: number) {
  const ops = mintWireOps([operation], { actor: AGENT, baseVersion: counter })
  expect(applyOps(host, ops, CATALOG).outcomes[0].outcome).toBe('applied')
}

function followerOf(host: Y.Doc): FollowerDoc {
  const follower = new FollowerDoc()
  follower.applyRemoteUpdate(Y.encodeStateAsUpdate(host))
  return follower
}

function senderOver(follower: FollowerDoc) {
  const sent: DocOp[][] = []
  const sender = createOpSender({
    sendOps: (_workflowId, _tab, ops) => {
      sent.push([...ops])
      return true
    },
    onOpsResult: () => () => {},
    workflowId: () => WORKFLOW_ID,
    tab: 'tab-1',
    actor: () => HUMAN,
    lamportFloor: () => follower.lamportFloor(),
    onBatchSettled: () => {}
  })
  const admitted = (): number[] =>
    sender.pendingOps().flatMap(({ ops }) => ops.map((op) => op.stamp[0]))
  return { sender, sent, admitted }
}

describe('human op stamps tick over the follower doc', () => {
  it('stamps above an agent write the follower has seen, so the human write wins', () => {
    const host = mint(WORKFLOW, CATALOG)
    // The agent's counter is well above the handful of batches the host has
    // admitted, so a stamp taken from the host sequence would lose to it.
    agentWrite(host, setSteps(50), 50)
    const follower = followerOf(host)
    const { sender, sent } = senderOver(follower)

    sender.enqueue([setSteps(4)])

    expect(sent[0][0]).toMatchObject({ base_version: 51, stamp: [51, HUMAN] })
    const result = applyOps(host, sent[0] as unknown as Op[], CATALOG)
    expect(result.outcomes[0].outcome).toBe('applied')
    expect(readGraph(host).nodes.B.widgets).toMatchObject({ steps: 4 })
    sender.detach()
  })

  it('reads the floor from a doc holding an autogrow connect', () => {
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'TestImageSource',
            pos: [0, 0],
            outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }]
          },
          {
            id: 136,
            type: 'TestImageList',
            pos: [400, 0],
            inputs: [{ name: 'images.image0', type: 'IMAGE', link: null }]
          }
        ],
        links: []
      },
      CATALOG
    )
    const growConnect = {
      ...mintWireOps(
        [
          {
            op: 'connect',
            from_node: 1,
            from_slot: 0,
            to_node: 136,
            to_slot: null,
            link_id: 7,
            link_type: 'IMAGE'
          } as unknown as GraphOperation
        ],
        { actor: AGENT, baseVersion: 30 }
      )[0],
      grow: { name: 'images.image1', type: 'IMAGE' }
    } as unknown as Op
    expect(applyOps(host, [growConnect], CATALOG).outcomes[0].outcome).toBe(
      'applied'
    )
    const stampKeys = [...host.getMap('__stamps').keys()]
    expect(stampKeys.some((key) => key.includes('grow_request'))).toBe(true)
    const follower = followerOf(host)
    const { sender, admitted } = senderOver(follower)

    sender.admit([setSteps(4)])

    expect(admitted()).toEqual([31])
    expect(reportError).not.toHaveBeenCalled()
    sender.detach()
  })

  it('reads the floor from a doc where a subgraph instance was deleted', () => {
    const subgraphId = '12345678-1234-4123-8123-123456789abc'
    const host = mint(
      {
        ...WORKFLOW,
        nodes: [
          ...WORKFLOW.nodes,
          { id: 'S', type: subgraphId, pos: [0, 0], inputs: [], outputs: [] }
        ],
        definitions: {
          subgraphs: [
            {
              id: subgraphId,
              name: 'One',
              inputs: [],
              outputs: [],
              nodes: [
                {
                  id: 10,
                  type: 'KSampler',
                  inputs: [],
                  outputs: [],
                  widgets_values: [1, 20]
                }
              ],
              links: []
            }
          ]
        }
      },
      CATALOG
    )
    agentWrite(host, setSteps(50), 50)
    agentWrite(
      host,
      {
        op: 'delete_node',
        node_id: 'S',
        removed_links: []
      } as unknown as GraphOperation,
      30
    )
    const stampKeys = [...host.getMap('__stamps').keys()]
    expect(stampKeys.some((key) => key.startsWith('["interior_route",'))).toBe(
      true
    )
    const { sender, admitted } = senderOver(followerOf(host))

    sender.admit([setSteps(4)])

    expect(admitted()).toEqual([51])
    expect(reportError).not.toHaveBeenCalled()
    sender.detach()
  })

  it('keeps a second batch above the first while the host has echoed neither', () => {
    const host = mint(WORKFLOW, CATALOG)
    agentWrite(host, setSteps(50), 50)
    const follower = followerOf(host)
    const { sender, admitted } = senderOver(follower)

    sender.admit([
      setSteps(4),
      { op: 'set_widget', node_id: 'B', widget: 'seed', value: 5 }
    ])
    sender.flush()
    // No remote frame arrives, so the doc floor is still 50.
    sender.admit([setSteps(6)])

    expect(admitted()).toEqual([51, 52, 53])
    sender.detach()
  })

  it('mints from 1 on a follower doc no frame has seeded yet', () => {
    const { sender, admitted } = senderOver(new FollowerDoc())

    sender.admit([setSteps(4)])
    sender.admit([setSteps(5)])

    expect(admitted()).toEqual([1, 2])
    sender.detach()
  })
})
