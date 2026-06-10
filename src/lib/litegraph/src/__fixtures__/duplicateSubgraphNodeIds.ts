import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'
import { asNodeId } from '@/lib/litegraph/src/litegraph'

/**
 * Workflow with two subgraph definitions whose internal nodes share
 * identical IDs [3, 8, 37]. Reproduces the widget-state collision bug
 * where copied subgraphs overwrote each other's widget store entries.
 *
 * SubgraphA (node 102): widgets reference node 3, link 3→8
 * SubgraphB (node 103): widgets reference node 8, link 3→37
 */
export const duplicateSubgraphNodeIds = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  version: 1,
  revision: 0,
  state: {
    lastNodeId: 100,
    lastLinkId: 10,
    lastGroupId: 0,
    lastRerouteId: 0
  },
  nodes: [
    {
      id: asNodeId(102),
      type: '11111111-1111-4111-8111-111111111111',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      properties: { proxyWidgets: [['3', 'seed']] }
    },
    {
      id: asNodeId(103),
      type: '22222222-2222-4222-8222-222222222222',
      pos: [300, 0],
      size: [200, 100],
      flags: {},
      order: 1,
      mode: 0,
      properties: { proxyWidgets: [['8', 'prompt']] }
    }
  ],
  definitions: {
    subgraphs: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        version: 1,
        revision: 0,
        state: {
          lastNodeId: 0,
          lastLinkId: 0,
          lastGroupId: 0,
          lastRerouteId: 0
        },
        name: 'SubgraphA',
        config: {},
        inputNode: { id: -10, bounding: [10, 100, 150, 126] },
        outputNode: { id: -20, bounding: [400, 100, 140, 126] },
        inputs: [],
        outputs: [],
        widgets: [{ id: asNodeId(3), name: 'seed' }],
        nodes: [
          {
            id: asNodeId(3),
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 0,
            mode: 0
          },
          {
            id: asNodeId(8),
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 1,
            mode: 0
          },
          {
            id: asNodeId(37),
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 2,
            mode: 0
          }
        ],
        links: [
          {
            id: 1,
            origin_id: asNodeId(3),
            origin_slot: 0,
            target_id: asNodeId(8),
            target_slot: 0,
            type: 'number'
          }
        ],
        groups: []
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        version: 1,
        revision: 0,
        state: {
          lastNodeId: 0,
          lastLinkId: 0,
          lastGroupId: 0,
          lastRerouteId: 0
        },
        name: 'SubgraphB',
        config: {},
        inputNode: { id: -10, bounding: [10, 100, 150, 126] },
        outputNode: { id: -20, bounding: [400, 100, 140, 126] },
        inputs: [],
        outputs: [],
        widgets: [{ id: asNodeId(8), name: 'prompt' }],
        nodes: [
          {
            id: asNodeId(3),
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 0,
            mode: 0
          },
          {
            id: asNodeId(8),
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 1,
            mode: 0
          },
          {
            id: asNodeId(37),
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 2,
            mode: 0
          }
        ],
        links: [
          {
            id: 2,
            origin_id: asNodeId(3),
            origin_slot: 0,
            target_id: asNodeId(37),
            target_slot: 0,
            type: 'string'
          }
        ],
        groups: []
      }
    ]
  }
} as const satisfies SerialisableGraph
