import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'

/**
 * The shape that actually reached production, rather than a synthetic value
 * near the former fixed ceiling.
 *
 * Both ids below are real, taken from `cloud-frontend-prod` telemetry:
 *
 * - `4462758126524329` is a node id this app minted itself, through
 *   `mintCrdtDisjointNodeId` — bit 41 set, bit 40 clear.
 * - `7729209487955825` is a link id the server-side agent minted, through
 *   comfy-cli's `mint_id()` (`2**40 | random52`) — bit 40 set.
 *
 * The two id classes are poisoned by the two different routes production
 * took, deliberately:
 *
 * - `lastNodeId` arrives already raised, as it is on the live graph that
 *   copy, paste and clone run against: `observeNodeId` raised it when this
 *   app's own node materialized, long before any deduplication pass.
 * - `lastLinkId` starts at zero and is raised *inside* the pass, because
 *   `deduplicateSubgraphLinkIds` observes every reserved link id — including
 *   the agent-minted one interior to SubgraphA — before it remaps anything.
 *
 * Observation has never had a ceiling; minting used to. So in both classes
 * the first duplicate subgraph-scoped id that needed remapping minted from a
 * counter in the quadrillions and threw `Node ID space exhausted` on its
 * first candidate, aborting copy, paste, clone and workflow load.
 *
 * Both subgraph definitions therefore share node ids `[3, 8, 37]` AND link
 * id `7729209487955825`, so configuring this graph has to remap in both id
 * classes from a reserved-range high-water mark.
 */
export const nodeIdsFromReservedMintRange = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  version: 1,
  revision: 0,
  state: {
    lastNodeId: 4_462_758_126_524_329,
    lastLinkId: 0,
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
      properties: { proxyWidgets: [['3', 'seed']] }
    },
    {
      id: 103,
      type: '22222222-2222-4222-8222-222222222222',
      pos: [300, 0],
      size: [200, 100],
      flags: {},
      order: 1,
      mode: 0,
      properties: { proxyWidgets: [['8', 'prompt']] }
    },
    {
      id: 4_462_758_126_524_329,
      type: 'dummy',
      pos: [600, 0],
      size: [100, 50],
      flags: {},
      order: 2,
      mode: 0
    },
    /**
     * The successor of the node high-water mark, reserved so the first
     * remap candidate is already taken and minting has to fall through to
     * collision recovery — the branch the former ceiling guarded. Node
     * deduplication reserves root ids without observing them, so this does
     * not itself raise `lastNodeId`; link, group and reroute deduplication
     * observe every reserved id, so the same gap cannot be built there from
     * a fixture, and `idAllocation.property.test.ts` covers those three
     * recovery paths directly instead.
     */
    {
      id: 4_462_758_126_524_330,
      type: 'dummy',
      pos: [900, 0],
      size: [100, 50],
      flags: {},
      order: 3,
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
        inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [10, 100, 150, 126] },
        outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [400, 100, 140, 126] },
        inputs: [],
        outputs: [],
        widgets: [{ id: 3, name: 'seed' }],
        nodes: [
          {
            id: 3,
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 0,
            mode: 0
          },
          {
            id: 8,
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 1,
            mode: 0
          },
          {
            id: 37,
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
            id: 7_729_209_487_955_825,
            origin_id: 3,
            origin_slot: 0,
            target_id: 8,
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
        inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [10, 100, 150, 126] },
        outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [400, 100, 140, 126] },
        inputs: [],
        outputs: [],
        widgets: [{ id: 8, name: 'prompt' }],
        nodes: [
          {
            id: 3,
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 0,
            mode: 0
          },
          {
            id: 8,
            type: 'dummy',
            pos: [0, 0],
            size: [100, 50],
            flags: {},
            order: 1,
            mode: 0
          },
          {
            id: 37,
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
            id: 7_729_209_487_955_825,
            origin_id: 3,
            origin_slot: 0,
            target_id: 37,
            target_slot: 0,
            type: 'string'
          }
        ],
        groups: []
      }
    ]
  }
} as const satisfies SerialisableGraph
