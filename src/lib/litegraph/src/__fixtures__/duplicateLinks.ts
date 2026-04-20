import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'

/**
 * Root graph with two nodes (Source, Target) connected by one valid link
 * plus two duplicate links sharing the same connection tuple.
 * Tests that configure() deduplicates to a single link.
 */
export const duplicateLinksRoot: SerialisableGraph = {
  id: 'dd000000-0000-4000-8000-000000000001',
  version: 1,
  revision: 0,
  state: {
    lastNodeId: 2,
    lastLinkId: 3,
    lastGroupId: 0,
    lastRerouteId: 0
  },
  nodes: [
    {
      id: 1,
      type: 'test/DupTestNode',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [{ name: 'input_0', type: 'number', link: null }],
      outputs: [{ name: 'output_0', type: 'number', links: [1, 2, 3] }],
      properties: {}
    },
    {
      id: 2,
      type: 'test/DupTestNode',
      pos: [300, 0],
      size: [200, 100],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [{ name: 'input_0', type: 'number', link: 1 }],
      outputs: [{ name: 'output_0', type: 'number', links: [] }],
      properties: {}
    }
  ],
  links: [
    {
      id: 1,
      origin_id: 1,
      origin_slot: 0,
      target_id: 2,
      target_slot: 0,
      type: 'number'
    },
    {
      id: 2,
      origin_id: 1,
      origin_slot: 0,
      target_id: 2,
      target_slot: 0,
      type: 'number'
    },
    {
      id: 3,
      origin_id: 1,
      origin_slot: 0,
      target_id: 2,
      target_slot: 0,
      type: 'number'
    }
  ]
}

/**
 * Root graph with slot-shifted duplicates. Target node has an extra input
 * (simulating widget-to-input conversion) that shifts the connected input
 * from slot 0 to slot 1. Link 1 is valid (referenced by input.link),
 * link 2 is a duplicate with the original (pre-shift) target_slot.
 */
export const duplicateLinksSlotShift: SerialisableGraph = {
  id: 'dd000000-0000-4000-8000-000000000002',
  version: 1,
  revision: 0,
  state: {
    lastNodeId: 2,
    lastLinkId: 2,
    lastGroupId: 0,
    lastRerouteId: 0
  },
  nodes: [
    {
      id: 1,
      type: 'test/DupTestNode',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [{ name: 'input_0', type: 'number', link: null }],
      outputs: [{ name: 'output_0', type: 'number', links: [1, 2] }],
      properties: {}
    },
    {
      id: 2,
      type: 'test/DupTestNode',
      pos: [300, 0],
      size: [200, 100],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [
        { name: 'extra_widget', type: 'number', link: null },
        { name: 'input_0', type: 'number', link: 1 }
      ],
      outputs: [{ name: 'output_0', type: 'number', links: [] }],
      properties: {}
    }
  ],
  links: [
    {
      id: 1,
      origin_id: 1,
      origin_slot: 0,
      target_id: 2,
      target_slot: 0,
      type: 'number'
    },
    {
      id: 2,
      origin_id: 1,
      origin_slot: 0,
      target_id: 2,
      target_slot: 0,
      type: 'number'
    }
  ]
}

/**
 * Root graph containing a SubgraphNode whose subgraph definition has
 * duplicate links. Tests that configure() deduplicates links inside
 * subgraph definitions during root-level configure.
 */
export const duplicateLinksSubgraph: SerialisableGraph = {
  id: 'dd000000-0000-4000-8000-000000000003',
  version: 1,
  revision: 0,
  state: {
    lastNodeId: 1,
    lastLinkId: 0,
    lastGroupId: 0,
    lastRerouteId: 0
  },
  nodes: [
    {
      id: 1,
      type: 'dd111111-1111-4111-8111-111111111111',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      properties: {}
    }
  ],
  definitions: {
    subgraphs: [
      {
        id: 'dd111111-1111-4111-8111-111111111111',
        version: 1,
        revision: 0,
        state: {
          lastNodeId: 2,
          lastLinkId: 3,
          lastGroupId: 0,
          lastRerouteId: 0
        },
        name: 'Subgraph With Duplicates',
        config: {},
        inputNode: { id: -10, bounding: [0, 100, 120, 60] },
        outputNode: { id: -20, bounding: [500, 100, 120, 60] },
        inputs: [],
        outputs: [],
        widgets: [],
        nodes: [
          {
            id: 1,
            type: 'test/Source',
            pos: [100, 100],
            size: [200, 100],
            flags: {},
            order: 0,
            mode: 0,
            inputs: [],
            outputs: [{ name: 'out', type: 'number', links: [1, 2, 3] }],
            properties: {}
          },
          {
            id: 2,
            type: 'test/Target',
            pos: [400, 100],
            size: [200, 100],
            flags: {},
            order: 1,
            mode: 0,
            inputs: [{ name: 'in', type: 'number', link: 1 }],
            outputs: [],
            properties: {}
          }
        ],
        groups: [],
        links: [
          {
            id: 1,
            origin_id: 1,
            origin_slot: 0,
            target_id: 2,
            target_slot: 0,
            type: 'number'
          },
          {
            id: 2,
            origin_id: 1,
            origin_slot: 0,
            target_id: 2,
            target_slot: 0,
            type: 'number'
          },
          {
            id: 3,
            origin_id: 1,
            origin_slot: 0,
            target_id: 2,
            target_slot: 0,
            type: 'number'
          }
        ],
        extra: {}
      }
    ]
  }
}
