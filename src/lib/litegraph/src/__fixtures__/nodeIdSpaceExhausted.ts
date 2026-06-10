import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'
import { asNodeId } from '@/lib/litegraph/src/litegraph'

/**
 * Workflow where lastNodeId is near the MAX_NODE_ID ceiling (100_000_000)
 * and root node 100_000_000 reserves the only remaining candidate ID.
 *
 * Both subgraph definitions share node IDs [3, 8, 37]. When SubgraphB's
 * duplicates need remapping, candidate 100_000_000 is already reserved,
 * so the next candidate (100_000_001) exceeds MAX_NODE_ID and must throw.
 */
export const nodeIdSpaceExhausted = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  version: 1,
  revision: 0,
  state: {
    lastNodeId: 99_999_999,
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
    },
    {
      id: asNodeId(100_000_000),
      type: 'dummy',
      pos: [600, 0],
      size: [100, 50],
      flags: {},
      order: 2,
      mode: 0
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
