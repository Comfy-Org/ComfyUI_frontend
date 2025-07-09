import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyApi } from '@/scripts/api'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ComfyApi', () => {
  let api: ComfyApi

  beforeEach(() => {
    vi.clearAllMocks()
    api = new ComfyApi()
    api.api_base = '/test'
  })

  describe('getHistory', () => {
    it('should return empty history when API call fails', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'))

      const result = await api.getHistory()

      expect(result).toEqual({ History: [] })
    })

    it('should return unsorted history when no execution_start messages exist', async () => {
      const mockHistoryData = {
        '1': {
          prompt: [1, 'prompt-1', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [
              ['execution_success', { prompt_id: 'prompt-1', timestamp: 1000 }]
            ]
          }
        },
        '2': {
          prompt: [2, 'prompt-2', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [
              ['execution_success', { prompt_id: 'prompt-2', timestamp: 2000 }]
            ]
          }
        }
      }

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockHistoryData)
      })

      const result = await api.getHistory()

      expect(result.History).toHaveLength(2)
      expect(result.History[0]).toEqual({
        ...mockHistoryData['1'],
        taskType: 'History'
      })
      expect(result.History[1]).toEqual({
        ...mockHistoryData['2'],
        taskType: 'History'
      })
    })

    it('should sort history by execution_start timestamp in descending order', async () => {
      const mockHistoryData = {
        '1': {
          prompt: [1, 'prompt-1', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [
              ['execution_start', { prompt_id: 'prompt-1', timestamp: 1000 }],
              ['execution_success', { prompt_id: 'prompt-1', timestamp: 1100 }]
            ]
          }
        },
        '2': {
          prompt: [2, 'prompt-2', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [
              ['execution_start', { prompt_id: 'prompt-2', timestamp: 3000 }],
              ['execution_success', { prompt_id: 'prompt-2', timestamp: 3100 }]
            ]
          }
        },
        '3': {
          prompt: [3, 'prompt-3', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [
              ['execution_start', { prompt_id: 'prompt-3', timestamp: 2000 }],
              ['execution_success', { prompt_id: 'prompt-3', timestamp: 2100 }]
            ]
          }
        }
      }

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockHistoryData)
      })

      const result = await api.getHistory()

      expect(result.History).toHaveLength(3)
      // Should be sorted by execution_start timestamp: 3000, 2000, 1000
      expect(result.History[0].prompt[1]).toBe('prompt-2') // timestamp 3000
      expect(result.History[1].prompt[1]).toBe('prompt-3') // timestamp 2000
      expect(result.History[2].prompt[1]).toBe('prompt-1') // timestamp 1000
    })

    it('should handle items without status or messages', async () => {
      const mockHistoryData = {
        '1': {
          prompt: [1, 'prompt-1', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [
              ['execution_start', { prompt_id: 'prompt-1', timestamp: 2000 }]
            ]
          }
        },
        '2': {
          prompt: [2, 'prompt-2', {}],
          outputs: {}
          // No status field
        },
        '3': {
          prompt: [3, 'prompt-3', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [] // Empty messages array
          }
        },
        '4': {
          prompt: [4, 'prompt-4', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [
              ['execution_start', { prompt_id: 'prompt-4', timestamp: 1000 }]
            ]
          }
        }
      }

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockHistoryData)
      })

      const result = await api.getHistory()

      expect(result.History).toHaveLength(4)
      // Items with execution_start should be sorted by timestamp (descending)
      // Items without execution_start should be sorted with timestamp 0 (appear last)
      expect(result.History[0].prompt[1]).toBe('prompt-1') // timestamp 2000
      expect(result.History[1].prompt[1]).toBe('prompt-4') // timestamp 1000
      // Items without execution_start timestamps should appear at the end
      expect(result.History[2].prompt[1]).toBe('prompt-2') // no status
      expect(result.History[3].prompt[1]).toBe('prompt-3') // empty messages
    })

    it('should handle mixed message types and find execution_start', async () => {
      const mockHistoryData = {
        '1': {
          prompt: [1, 'prompt-1', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [
              ['execution_cached', { prompt_id: 'prompt-1', timestamp: 900 }],
              ['execution_start', { prompt_id: 'prompt-1', timestamp: 1000 }],
              ['execution_success', { prompt_id: 'prompt-1', timestamp: 1100 }]
            ]
          }
        },
        '2': {
          prompt: [2, 'prompt-2', {}],
          outputs: {},
          status: {
            status_str: 'error',
            completed: true,
            messages: [
              ['execution_start', { prompt_id: 'prompt-2', timestamp: 2000 }],
              [
                'execution_error',
                {
                  prompt_id: 'prompt-2',
                  timestamp: 2100,
                  node_id: 'node-1',
                  node_type: 'TestNode',
                  executed: [],
                  exception_message: 'Test error',
                  exception_type: 'ValueError',
                  traceback: [],
                  current_inputs: {},
                  current_outputs: {}
                }
              ]
            ]
          }
        }
      }

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockHistoryData)
      })

      const result = await api.getHistory()

      expect(result.History).toHaveLength(2)
      // Should be sorted by execution_start timestamp: 2000, 1000
      expect(result.History[0].prompt[1]).toBe('prompt-2') // timestamp 2000
      expect(result.History[1].prompt[1]).toBe('prompt-1') // timestamp 1000
    })

    it('should respect max_items parameter', async () => {
      const mockHistoryData = {
        '1': { prompt: [1, 'prompt-1', {}], outputs: {} },
        '2': { prompt: [2, 'prompt-2', {}], outputs: {} }
      }

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockHistoryData)
      })

      await api.getHistory(50)

      expect(mockFetch).toHaveBeenCalledWith(
        '/test/api/history?max_items=50',
        expect.objectContaining({
          cache: 'no-cache',
          headers: expect.objectContaining({
            'Comfy-User': ''
          })
        })
      )
    })

    it('should use default max_items of 200', async () => {
      const mockHistoryData = {}

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockHistoryData)
      })

      await api.getHistory()

      expect(mockFetch).toHaveBeenCalledWith(
        '/test/api/history?max_items=200',
        expect.objectContaining({
          cache: 'no-cache'
        })
      )
    })

    it('should add taskType to all history items', async () => {
      const mockHistoryData = {
        '1': {
          prompt: [1, 'prompt-1', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [
              ['execution_start', { prompt_id: 'prompt-1', timestamp: 1000 }]
            ]
          }
        }
      }

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockHistoryData)
      })

      const result = await api.getHistory()

      expect(result.History).toHaveLength(1)
      expect(result.History[0].taskType).toBe('History')
    })

    it('should handle empty history response', async () => {
      const mockHistoryData = {}

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockHistoryData)
      })

      const result = await api.getHistory()

      expect(result.History).toEqual([])
    })

    it('should handle identical timestamps consistently', async () => {
      const mockHistoryData = {
        '1': {
          prompt: [1, 'prompt-1', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [
              ['execution_start', { prompt_id: 'prompt-1', timestamp: 1000 }]
            ]
          }
        },
        '2': {
          prompt: [2, 'prompt-2', {}],
          outputs: {},
          status: {
            status_str: 'success',
            completed: true,
            messages: [
              ['execution_start', { prompt_id: 'prompt-2', timestamp: 1000 }]
            ]
          }
        }
      }

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockHistoryData)
      })

      const result = await api.getHistory()

      expect(result.History).toHaveLength(2)
      // Both items should be present, order may vary for identical timestamps
      const promptIds = result.History.map((item) => item.prompt[1])
      expect(promptIds).toContain('prompt-1')
      expect(promptIds).toContain('prompt-2')
    })
  })
})
