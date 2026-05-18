import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'

export const subgraphComplexPromotion1 = {
  id: 'e49902fa-ee3e-40e6-a59e-c8931888ad0e',
  revision: 0,
  last_node_id: 21,
  last_link_id: 23,
  nodes: [
    {
      id: 12,
      type: 'PreviewAny',
      pos: [1367.8236034435063, 305.51100163315823],
      size: [225, 166],
      flags: {},
      order: 3,
      mode: 0,
      inputs: [
        {
          name: 'source',
          type: '*',
          link: 21
        }
      ],
      outputs: [],
      properties: {
        'Node name for S&R': 'PreviewAny'
      },
      widgets_values: [null, null, null]
    },
    {
      id: 13,
      type: 'PreviewAny',
      pos: [1271.9742739655217, 551.9124470179938],
      size: [225, 166],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [
        {
          name: 'source',
          type: '*',
          link: 19
        }
      ],
      outputs: [],
      properties: {
        'Node name for S&R': 'PreviewAny'
      },
      widgets_values: [null, null, null]
    },
    {
      id: 14,
      type: 'PreviewAny',
      pos: [1414.8695925586444, 847.9456885036253],
      size: [225, 166],
      flags: {},
      order: 2,
      mode: 0,
      inputs: [
        {
          name: 'source',
          type: '*',
          link: 20
        }
      ],
      outputs: [],
      properties: {
        'Node name for S&R': 'PreviewAny'
      },
      widgets_values: [null, null, null]
    },
    {
      id: 21,
      type: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f',
      pos: [741.0375276545419, 560.8496560588814],
      size: [225, 305.3333435058594],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [
        {
          name: 'STRING',
          type: 'STRING',
          links: [19]
        },
        {
          name: 'STRING_1',
          type: 'STRING',
          links: [20]
        },
        {
          name: 'STRING_2',
          type: 'STRING',
          links: [21]
        }
      ],
      properties: {
        proxyWidgets: [
          ['20', 'string_a'],
          ['19', 'string_a'],
          ['18', 'string_a']
        ]
      },
      widgets_values: []
    }
  ],
  links: [
    [19, 21, 0, 13, 0, 'STRING'],
    [20, 21, 1, 14, 0, 'STRING'],
    [21, 21, 2, 12, 0, 'STRING']
  ],
  groups: [],
  definitions: {
    subgraphs: [
      {
        id: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f',
        version: 1,
        state: {
          lastGroupId: 0,
          lastNodeId: 21,
          lastLinkId: 23,
          lastRerouteId: 0
        },
        revision: 0,
        config: {},
        name: 'New Subgraph',
        inputNode: {
          id: -10,
          bounding: [596.9206067268835, 805.5404332481304, 120, 60]
        },
        outputNode: {
          id: -20,
          bounding: [1376.7286067268833, 769.5404332481304, 120, 100]
        },
        inputs: [
          {
            id: '78479bf4-8145-41d5-9d11-c38e3149fc59',
            name: 'string_a',
            type: 'STRING',
            linkIds: [22, 23],
            pos: [696.9206067268835, 825.5404332481304]
          }
        ],
        outputs: [
          {
            id: 'aa263e4e-b558-4dbf-bcb9-ff0c1c72cbef',
            name: 'STRING',
            type: 'STRING',
            linkIds: [16],
            localized_name: 'STRING',
            pos: [1396.7286067268833, 789.5404332481304]
          },
          {
            id: '8eee6fe3-dc2f-491a-9e01-04ef83309dad',
            name: 'STRING_1',
            type: 'STRING',
            linkIds: [17],
            localized_name: 'STRING_1',
            pos: [1396.7286067268833, 809.5404332481304]
          },
          {
            id: 'a446d5b9-6042-434d-848a-5d3af5e8e0d4',
            name: 'STRING_2',
            type: 'STRING',
            linkIds: [18],
            localized_name: 'STRING_2',
            pos: [1396.7286067268833, 829.5404332481304]
          }
        ],
        widgets: [],
        nodes: [
          {
            id: 18,
            type: 'StringConcatenate',
            pos: [818.5102631756379, 706.4562049408103],
            size: [480, 268],
            flags: {},
            order: 0,
            mode: 0,
            inputs: [
              {
                localized_name: 'string_a',
                name: 'string_a',
                type: 'STRING',
                widget: {
                  name: 'string_a'
                },
                link: 23
              }
            ],
            outputs: [
              {
                localized_name: 'STRING',
                name: 'STRING',
                type: 'STRING',
                links: [16]
              }
            ],
            title: 'InnerCatB',
            properties: {
              'Node name for S&R': 'StringConcatenate'
            },
            widgets_values: ['Poop', '_B', '']
          },
          {
            id: 19,
            type: 'StringConcatenate',
            pos: [812.9370280206649, 1040.648423402667],
            size: [480, 268],
            flags: {},
            order: 1,
            mode: 0,
            inputs: [],
            outputs: [
              {
                localized_name: 'STRING',
                name: 'STRING',
                type: 'STRING',
                links: [17]
              }
            ],
            title: 'InnerCatC',
            properties: {
              'Node name for S&R': 'StringConcatenate'
            },
            widgets_values: ['', '_C', '']
          },
          {
            id: 20,
            type: 'StringConcatenate',
            pos: [824.7110975088726, 386.4230523609899],
            size: [480, 268],
            flags: {},
            order: 2,
            mode: 0,
            inputs: [
              {
                localized_name: 'string_a',
                name: 'string_a',
                type: 'STRING',
                widget: {
                  name: 'string_a'
                },
                link: 22
              }
            ],
            outputs: [
              {
                localized_name: 'STRING',
                name: 'STRING',
                type: 'STRING',
                links: [18]
              }
            ],
            title: 'InnerCatA',
            properties: {
              'Node name for S&R': 'StringConcatenate'
            },
            widgets_values: ['Poop', '_A', '']
          }
        ],
        groups: [],
        links: [
          {
            id: 16,
            origin_id: 18,
            origin_slot: 0,
            target_id: -20,
            target_slot: 0,
            type: 'STRING'
          },
          {
            id: 17,
            origin_id: 19,
            origin_slot: 0,
            target_id: -20,
            target_slot: 1,
            type: 'STRING'
          },
          {
            id: 18,
            origin_id: 20,
            origin_slot: 0,
            target_id: -20,
            target_slot: 2,
            type: 'STRING'
          },
          {
            id: 22,
            origin_id: -10,
            origin_slot: 0,
            target_id: 20,
            target_slot: 0,
            type: 'STRING'
          },
          {
            id: 23,
            origin_id: -10,
            origin_slot: 0,
            target_id: 18,
            target_slot: 0,
            type: 'STRING'
          }
        ],
        extra: {
          workflowRendererVersion: 'Vue'
        }
      }
    ]
  },
  config: {},
  extra: {
    ds: {
      scale: 0.6638894832438259,
      offset: [-408.2009703049473, -183.8039508449224]
    },
    workflowRendererVersion: 'Vue',
    frontendVersion: '1.42.3'
  },
  version: 0.4
} as const as unknown as ISerialisedGraph
