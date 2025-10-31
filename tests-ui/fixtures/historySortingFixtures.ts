/**
 * @fileoverview Test fixtures for history V2 timestamp-based sorting
 */
import type { HistoryResponseV2 } from '@/platform/remote/comfyui/history/types/historyV2Types'

export const historyV2WithMissingTimestamp: HistoryResponseV2 = {
  history: [
    {
      prompt_id: 'item-timestamp-1000',
      prompt: {
        priority: 0,
        prompt_id: 'item-timestamp-1000',
        extra_data: {
          client_id: 'test-client'
        }
      },
      outputs: {
        '1': {
          images: [{ filename: 'test1.png', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: [
          [
            'execution_success',
            { prompt_id: 'item-timestamp-1000', timestamp: 1000 }
          ]
        ]
      }
    },
    {
      prompt_id: 'item-timestamp-2000',
      prompt: {
        priority: 0,
        prompt_id: 'item-timestamp-2000',
        extra_data: {
          client_id: 'test-client'
        }
      },
      outputs: {
        '2': {
          images: [{ filename: 'test2.png', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: [
          [
            'execution_success',
            { prompt_id: 'item-timestamp-2000', timestamp: 2000 }
          ]
        ]
      }
    },
    {
      prompt_id: 'item-no-timestamp',
      prompt: {
        priority: 0,
        prompt_id: 'item-no-timestamp',
        extra_data: {
          client_id: 'test-client'
        }
      },
      outputs: {
        '3': {
          images: [{ filename: 'test3.png', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: []
      }
    }
  ]
}

export const historyV2FiveItemsSorting: HistoryResponseV2 = {
  history: [
    {
      prompt_id: 'item-timestamp-3000',
      prompt: {
        priority: 0,
        prompt_id: 'item-timestamp-3000',
        extra_data: { client_id: 'test-client' }
      },
      outputs: {
        '1': {
          images: [{ filename: 'test1.png', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: [
          [
            'execution_success',
            { prompt_id: 'item-timestamp-3000', timestamp: 3000 }
          ]
        ]
      }
    },
    {
      prompt_id: 'item-timestamp-1000',
      prompt: {
        priority: 0,
        prompt_id: 'item-timestamp-1000',
        extra_data: { client_id: 'test-client' }
      },
      outputs: {
        '2': {
          images: [{ filename: 'test2.png', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: [
          [
            'execution_success',
            { prompt_id: 'item-timestamp-1000', timestamp: 1000 }
          ]
        ]
      }
    },
    {
      prompt_id: 'item-timestamp-5000',
      prompt: {
        priority: 0,
        prompt_id: 'item-timestamp-5000',
        extra_data: { client_id: 'test-client' }
      },
      outputs: {
        '3': {
          images: [{ filename: 'test3.png', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: [
          [
            'execution_success',
            { prompt_id: 'item-timestamp-5000', timestamp: 5000 }
          ]
        ]
      }
    },
    {
      prompt_id: 'item-timestamp-2000',
      prompt: {
        priority: 0,
        prompt_id: 'item-timestamp-2000',
        extra_data: { client_id: 'test-client' }
      },
      outputs: {
        '4': {
          images: [{ filename: 'test4.png', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: [
          [
            'execution_success',
            { prompt_id: 'item-timestamp-2000', timestamp: 2000 }
          ]
        ]
      }
    },
    {
      prompt_id: 'item-timestamp-4000',
      prompt: {
        priority: 0,
        prompt_id: 'item-timestamp-4000',
        extra_data: { client_id: 'test-client' }
      },
      outputs: {
        '5': {
          images: [{ filename: 'test5.png', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: [
          [
            'execution_success',
            { prompt_id: 'item-timestamp-4000', timestamp: 4000 }
          ]
        ]
      }
    }
  ]
}

export const historyV2MultipleNoTimestamp: HistoryResponseV2 = {
  history: [
    {
      prompt_id: 'item-no-timestamp-1',
      prompt: {
        priority: 0,
        prompt_id: 'item-no-timestamp-1',
        extra_data: { client_id: 'test-client' }
      },
      outputs: {
        '1': {
          images: [{ filename: 'test1.png', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: []
      }
    },
    {
      prompt_id: 'item-no-timestamp-2',
      prompt: {
        priority: 0,
        prompt_id: 'item-no-timestamp-2',
        extra_data: { client_id: 'test-client' }
      },
      outputs: {
        '2': {
          images: [{ filename: 'test2.png', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: []
      }
    },
    {
      prompt_id: 'item-no-timestamp-3',
      prompt: {
        priority: 0,
        prompt_id: 'item-no-timestamp-3',
        extra_data: { client_id: 'test-client' }
      },
      outputs: {
        '3': {
          images: [{ filename: 'test3.png', type: 'output', subfolder: '' }]
        }
      },
      status: {
        status_str: 'success',
        completed: true,
        messages: []
      }
    }
  ]
}
