import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'

/**
 * Workflow with two subgraph definitions whose internal nodes already
 * have unique IDs. Deduplication should be a no-op — all IDs, links,
 * widgets, and proxyWidgets pass through unchanged.
 *
 * SubgraphA (node 102): nodes [10, 11, 12], link 10→11, widget ref 10
 * SubgraphB (node 103): nodes [20, 21, 22], link 20→22, widget ref 21
 */
export const uniqueSubgraphNodeIds = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
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
      id: 102,
      type: '11111111-1111-4111-8111-111111111111',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      properties: { proxyWidgets: [['10', 'seed']] }
    },
    {
      id: 103,
      type: '22222222-2222-4222-8222-222222222222',
      pos: [300, 0],
      size: [200, 100],
      flags: {},
      order: 1,
      mode: 0,
      properties: { proxyWidgets: [['21', 'prompt']] }
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
        widgets: [{ id: 10, name: 'seed' }],
        nodes: [
          {
            id: 10,
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 0,
            mode: 0
          },
          {
            id: 11,
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 1,
            mode: 0
          },
          {
            id: 12,
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
            origin_id: 10,
            origin_slot: 0,
            target_id: 11,
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
        widgets: [{ id: 21, name: 'prompt' }],
        nodes: [
          {
            id: 20,
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 0,
            mode: 0
          },
          {
            id: 21,
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 1,
            mode: 0
          },
          {
            id: 22,
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
            origin_id: 20,
            origin_slot: 0,
            target_id: 22,
            target_slot: 0,
            type: 'string'
          }
        ],
        groups: []
      }
    ]
  }
} as const satisfies SerialisableGraph
