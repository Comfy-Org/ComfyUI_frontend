import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'

/**
 * Subgraph with two promoted widget inputs that have user-renamed labels.
 *
 * Structure:
 *   Root graph → SubgraphNode (id 2, type = subgraph UUID)
 *     Interior: test/WidgetNode (id 1) with widget inputs "seed" and "steps"
 *
 * Subgraph inputs:
 *   - "seed"  (label: "my_seed")   → linked to interior node seed
 *   - "steps" (label: "num_steps") → linked to interior node steps
 *
 * The interior node type "test/WidgetNode" must be registered before
 * configure() — see the test setup.
 */
export const SUBGRAPH_UUID = 'aaaa0000-0001-4000-8000-000000000001'

export const renamedPromotedLabels: SerialisableGraph = {
  id: 'aaaa0000-0000-4000-8000-000000000001',
  version: 1,
  revision: 0,
  state: {
    lastNodeId: 2,
    lastLinkId: 0,
    lastGroupId: 0,
    lastRerouteId: 0
  },
  nodes: [
    {
      id: 2,
      type: SUBGRAPH_UUID,
      pos: [400, 300],
      size: [400, 200],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [
        {
          label: 'my_seed',
          name: 'seed',
          type: 'INT',
          widget: { name: 'seed' },
          link: null
        },
        {
          label: 'num_steps',
          name: 'steps',
          type: 'INT',
          widget: { name: 'steps' },
          link: null
        }
      ],
      outputs: [
        {
          name: 'OUTPUT',
          type: '*',
          links: null
        }
      ],
      properties: {
        proxyWidgets: [
          ['1', 'seed'],
          ['1', 'steps']
        ]
      },
      widgets_values: []
    }
  ],
  links: [],
  groups: [],
  definitions: {
    subgraphs: [
      {
        id: SUBGRAPH_UUID,
        version: 1,
        state: {
          lastGroupId: 0,
          lastNodeId: 1,
          lastLinkId: 4,
          lastRerouteId: 0
        },
        revision: 0,
        config: {},
        name: 'Renamed Labels Subgraph',
        inputNode: {
          id: -10,
          bounding: [200, 300, 120, 100]
        },
        outputNode: {
          id: -20,
          bounding: [900, 400, 120, 60]
        },
        inputs: [
          {
            id: 'slot-seed',
            name: 'seed',
            type: 'INT',
            linkIds: [1],
            label: 'my_seed',
            pos: [220, 320]
          },
          {
            id: 'slot-steps',
            name: 'steps',
            type: 'INT',
            linkIds: [2],
            label: 'num_steps',
            pos: [220, 340]
          }
        ],
        outputs: [
          {
            id: 'slot-out',
            name: 'OUTPUT',
            type: '*',
            linkIds: [3],
            pos: [920, 420]
          }
        ],
        widgets: [],
        nodes: [
          {
            id: 1,
            type: 'test/WidgetNode',
            pos: [500, 200],
            size: [270, 200],
            flags: {},
            order: 0,
            mode: 0,
            inputs: [
              {
                name: 'seed',
                type: 'INT',
                widget: { name: 'seed' },
                link: 1
              },
              {
                name: 'steps',
                type: 'INT',
                widget: { name: 'steps' },
                link: 2
              }
            ],
            outputs: [
              {
                name: 'OUTPUT',
                type: '*',
                links: [3]
              }
            ],
            properties: {},
            widgets_values: [42, 20]
          }
        ],
        groups: [],
        links: [
          {
            id: 1,
            origin_id: -10,
            origin_slot: 0,
            target_id: 1,
            target_slot: 0,
            type: 'INT'
          },
          {
            id: 2,
            origin_id: -10,
            origin_slot: 1,
            target_id: 1,
            target_slot: 1,
            type: 'INT'
          },
          {
            id: 3,
            origin_id: 1,
            origin_slot: 0,
            target_id: -20,
            target_slot: 0,
            type: '*'
          }
        ],
        extra: {}
      }
    ]
  },
  config: {},
  extra: {}
} as unknown as SerialisableGraph
