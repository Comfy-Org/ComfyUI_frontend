/**
 * @fileoverview Test fixtures for history tests.
 */
import type { HistoryResponseV2 } from '@/platform/remote/comfyui/history/types/historyV2Types'
import type { HistoryTaskItem } from '@/schemas/apiSchema'

/**
 * V1 API raw response format (object with prompt IDs as keys)
 */
export const historyV1RawResponse: Record<
  string,
  Omit<HistoryTaskItem, 'taskType'>
> = {
  'complete-item-id': {
    prompt: [
      24,
      'complete-item-id',
      {},
      {
        client_id: 'test-client',
        extra_pnginfo: {
          workflow: {
            id: '44f0c9f9-b5a7-48de-99fc-7e80c1570241',
            revision: 0,
            last_node_id: 9,
            last_link_id: 9,
            nodes: [],
            links: [],
            groups: [],
            config: {},
            extra: {},
            version: 0.4
          }
        }
      },
      ['9']
    ],
    outputs: {
      '9': {
        images: [
          {
            filename: 'test.png',
            subfolder: '',
            type: 'output'
          }
        ]
      }
    },
    status: {
      status_str: 'success',
      completed: true,
      messages: [
        [
          'execution_start',
          { prompt_id: 'complete-item-id', timestamp: 1234567890 }
        ],
        [
          'execution_success',
          { prompt_id: 'complete-item-id', timestamp: 1234567900 }
        ]
      ]
    },
    meta: {
      '9': {
        node_id: '9',
        display_node: '9'
      }
    }
  },
  'no-status-id': {
    prompt: [
      23,
      'no-status-id',
      {},
      {
        client_id: 'inference'
      },
      ['10']
    ],
    outputs: {
      '10': {
        images: []
      }
    },
    status: undefined,
    meta: {
      '10': {
        node_id: '10',
        display_node: '10'
      }
    }
  }
}

/**
 * V2 response with multiple edge cases:
 * - Item 0: Complete with all fields
 * - Item 1: Missing optional status field
 * - Item 2: Missing optional meta field
 * - Item 3: Multiple output nodes
 */
export const historyV2Fixture: HistoryResponseV2 = {
  history: [
    {
      prompt_id: 'complete-item-id',
      prompt: {
        priority: 24,
        prompt_id: 'complete-item-id',
        extra_data: {
          client_id: 'test-client',
          extra_pnginfo: {
            workflow: {
              id: '44f0c9f9-b5a7-48de-99fc-7e80c1570241',
              revision: 0,
              last_node_id: 9,
              last_link_id: 9,
              nodes: [],
              links: [],
              groups: [],
              config: {},
              extra: {},
              version: 0.4
            }
          }
        }
      },
      outputs: {
        '9': {
          images: [
            {
              filename: 'test.png',
              subfolder: '',
              type: 'output'
            }
          ]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: [
          [
            'execution_start',
            { prompt_id: 'complete-item-id', timestamp: 1234567890 }
          ],
          [
            'execution_success',
            { prompt_id: 'complete-item-id', timestamp: 1234567900 }
          ]
        ]
      },
      meta: {
        '9': {
          node_id: '9',
          display_node: '9'
        }
      }
    },
    {
      prompt_id: 'no-status-id',
      prompt: {
        priority: 23,
        prompt_id: 'no-status-id',
        extra_data: {
          client_id: 'inference'
        }
      },
      outputs: {
        '10': {
          images: []
        }
      },
      meta: {
        '10': {
          node_id: '10',
          display_node: '10'
        }
      }
    },
    {
      prompt_id: 'no-meta-id',
      prompt: {
        priority: 22,
        prompt_id: 'no-meta-id',
        extra_data: {
          client_id: 'web-ui'
        }
      },
      outputs: {
        '11': {
          audio: []
        }
      },
      status: {
        status_str: 'error',
        completed: false,
        messages: []
      }
    },
    {
      prompt_id: 'multi-output-id',
      prompt: {
        priority: 21,
        prompt_id: 'multi-output-id',
        extra_data: {
          client_id: 'batch-processor'
        }
      },
      outputs: {
        '3': {
          images: [{ filename: 'img1.png', type: 'output', subfolder: '' }]
        },
        '9': {
          images: [{ filename: 'img2.png', type: 'output', subfolder: '' }]
        },
        '12': {
          video: [{ filename: 'video.mp4', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: []
      },
      meta: {
        '3': { node_id: '3', display_node: '3' },
        '9': { node_id: '9', display_node: '9' },
        '12': { node_id: '12', display_node: '12' }
      }
    }
  ]
}

/**
 * Expected V1 transformation of historyV2Fixture
 * Priority is now synthetic based on execution_success timestamp:
 * - complete-item-id: has timestamp → priority 1 (only one with timestamp)
 * - no-status-id: no status → priority 0
 * - no-meta-id: empty messages → priority 0
 * - multi-output-id: empty messages → priority 0
 */
export const expectedV1Fixture: HistoryTaskItem[] = [
  {
    taskType: 'History',
    prompt: [
      1,
      'complete-item-id',
      {},
      {
        client_id: 'test-client',
        extra_pnginfo: {
          workflow: {
            id: '44f0c9f9-b5a7-48de-99fc-7e80c1570241',
            revision: 0,
            last_node_id: 9,
            last_link_id: 9,
            nodes: [],
            links: [],
            groups: [],
            config: {},
            extra: {},
            version: 0.4
          }
        }
      },
      ['9']
    ],
    outputs: {
      '9': {
        images: [
          {
            filename: 'test.png',
            subfolder: '',
            type: 'output'
          }
        ]
      }
    },
    status: {
      status_str: 'success',
      completed: true,
      messages: [
        [
          'execution_start',
          { prompt_id: 'complete-item-id', timestamp: 1234567890 }
        ],
        [
          'execution_success',
          { prompt_id: 'complete-item-id', timestamp: 1234567900 }
        ]
      ]
    },
    meta: {
      '9': {
        node_id: '9',
        display_node: '9'
      }
    }
  },
  {
    taskType: 'History',
    prompt: [
      0,
      'no-status-id',
      {},
      {
        client_id: 'inference'
      },
      ['10']
    ],
    outputs: {
      '10': {
        images: []
      }
    },
    status: undefined,
    meta: {
      '10': {
        node_id: '10',
        display_node: '10'
      }
    }
  },
  {
    taskType: 'History',
    prompt: [
      0,
      'no-meta-id',
      {},
      {
        client_id: 'web-ui'
      },
      ['11']
    ],
    outputs: {
      '11': {
        audio: []
      }
    },
    status: {
      status_str: 'error',
      completed: false,
      messages: []
    },
    meta: undefined
  },
  {
    taskType: 'History',
    prompt: [
      0,
      'multi-output-id',
      {},
      {
        client_id: 'batch-processor'
      },
      ['3', '9', '12']
    ],
    outputs: {
      '3': {
        images: [{ filename: 'img1.png', type: 'output', subfolder: '' }]
      },
      '9': {
        images: [{ filename: 'img2.png', type: 'output', subfolder: '' }]
      },
      '12': {
        video: [{ filename: 'video.mp4', type: 'output', subfolder: '' }]
      }
    },
    status: {
      status_str: 'success',
      completed: true,
      messages: []
    },
    meta: {
      '3': { node_id: '3', display_node: '3' },
      '9': { node_id: '9', display_node: '9' },
      '12': { node_id: '12', display_node: '12' }
    }
  }
]
