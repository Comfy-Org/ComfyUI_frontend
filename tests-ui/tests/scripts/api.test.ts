import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  HistoryResponse,
  RawHistoryItem
} from '../../../src/schemas/apiSchema'
import type { ComfyWorkflowJSON } from '../../../src/schemas/comfyWorkflowSchema'
import { ComfyApi } from '../../../src/scripts/api'

describe('ComfyApi getHistory', () => {
  let api: ComfyApi

  beforeEach(() => {
    api = new ComfyApi()
  })

  const mockHistoryItem: RawHistoryItem = {
    prompt_id: 'test_prompt_id',
    prompt: {
      priority: 0,
      prompt_id: 'test_prompt_id',
      extra_data: {
        extra_pnginfo: {
          workflow: {
            last_node_id: 1,
            last_link_id: 0,
            nodes: [],
            links: [],
            groups: [],
            config: {},
            extra: {},
            version: 0.4
          }
        },
        client_id: 'test_client_id'
      }
    },
    outputs: {},
    status: {
      status_str: 'success',
      completed: true,
      messages: []
    }
  }

  describe('history v2 API format', () => {
    it('should handle history array format from /history_v2', async () => {
      const historyResponse: HistoryResponse = {
        history: [
          { ...mockHistoryItem, prompt_id: 'prompt_id_1' },
          { ...mockHistoryItem, prompt_id: 'prompt_id_2' }
        ]
      }

      // Mock fetchApi to return the v2 format
      const mockFetchApi = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(historyResponse)
      })
      api.fetchApi = mockFetchApi

      const result = await api.getHistory(10)

      expect(result.History).toHaveLength(2)
      expect(result.History[0]).toEqual({
        ...mockHistoryItem,
        prompt_id: 'prompt_id_1',
        taskType: 'History'
      })
      expect(result.History[1]).toEqual({
        ...mockHistoryItem,
        prompt_id: 'prompt_id_2',
        taskType: 'History'
      })
    })

    it('should handle empty history array', async () => {
      const historyResponse: HistoryResponse = {
        history: []
      }

      const mockFetchApi = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(historyResponse)
      })
      api.fetchApi = mockFetchApi

      const result = await api.getHistory(10)

      expect(result.History).toHaveLength(0)
      expect(result.History).toEqual([])
    })
  })

  describe('error handling', () => {
    it('should return empty history on error', async () => {
      const mockFetchApi = vi.fn().mockRejectedValue(new Error('Network error'))
      api.fetchApi = mockFetchApi

      const result = await api.getHistory()

      expect(result.History).toEqual([])
    })
  })

  describe('API call parameters', () => {
    it('should call fetchApi with correct v2 endpoint and parameters', async () => {
      const mockFetchApi = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ history: [] })
      })
      api.fetchApi = mockFetchApi

      await api.getHistory(50)

      expect(mockFetchApi).toHaveBeenCalledWith('/history_v2?max_items=50')
    })

    it('should use default max_items parameter with v2 endpoint', async () => {
      const mockFetchApi = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ history: [] })
      })
      api.fetchApi = mockFetchApi

      await api.getHistory()

      expect(mockFetchApi).toHaveBeenCalledWith('/history_v2?max_items=200')
    })
  })
})

describe('ComfyApi getWorkflowFromHistory', () => {
  let api: ComfyApi

  beforeEach(() => {
    api = new ComfyApi()
  })

  const mockWorkflow: ComfyWorkflowJSON = {
    last_node_id: 1,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  }

  it('should fetch workflow data for a specific prompt', async () => {
    const promptId = 'test_prompt_id'
    const mockResponse = {
      [promptId]: {
        prompt: {
          priority: 0,
          prompt_id: promptId,
          extra_data: {
            extra_pnginfo: {
              workflow: mockWorkflow
            }
          }
        },
        outputs: {},
        status: {
          status_str: 'success',
          completed: true,
          messages: []
        }
      }
    }

    const mockFetchApi = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })
    api.fetchApi = mockFetchApi

    const result = await api.getWorkflowFromHistory(promptId)

    expect(mockFetchApi).toHaveBeenCalledWith(`/history_v2/${promptId}`)
    expect(result).toEqual(mockWorkflow)
  })

  it('should return null when prompt_id is not found', async () => {
    const promptId = 'non_existent_prompt'
    const mockResponse = {}

    const mockFetchApi = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })
    api.fetchApi = mockFetchApi

    const result = await api.getWorkflowFromHistory(promptId)

    expect(mockFetchApi).toHaveBeenCalledWith(`/history_v2/${promptId}`)
    expect(result).toBeNull()
  })

  it('should return null when workflow data is missing', async () => {
    const promptId = 'test_prompt_id'
    const mockResponse = {
      [promptId]: {
        prompt: {
          priority: 0,
          prompt_id: promptId,
          extra_data: {}
        },
        outputs: {},
        status: {
          status_str: 'success',
          completed: true,
          messages: []
        }
      }
    }

    const mockFetchApi = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })
    api.fetchApi = mockFetchApi

    const result = await api.getWorkflowFromHistory(promptId)

    expect(result).toBeNull()
  })

  it('should handle API errors gracefully', async () => {
    const promptId = 'test_prompt_id'
    const mockFetchApi = vi.fn().mockRejectedValue(new Error('Network error'))
    api.fetchApi = mockFetchApi

    const result = await api.getWorkflowFromHistory(promptId)

    expect(result).toBeNull()
  })

  it('should handle malformed response gracefully', async () => {
    const promptId = 'test_prompt_id'
    const mockResponse = {
      [promptId]: null
    }

    const mockFetchApi = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })
    api.fetchApi = mockFetchApi

    const result = await api.getWorkflowFromHistory(promptId)

    expect(result).toBeNull()
  })
})
