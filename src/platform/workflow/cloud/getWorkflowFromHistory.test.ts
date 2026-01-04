import { describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { getWorkflowFromHistory } from '@/platform/workflow/cloud/getWorkflowFromHistory'

const mockWorkflow: ComfyWorkflowJSON = {
  id: 'test-workflow-id',
  revision: 0,
  last_node_id: 5,
  last_link_id: 3,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

const mockHistoryResponse = {
  'test-prompt-id': {
    prompt: {
      priority: 1,
      prompt_id: 'test-prompt-id',
      extra_data: {
        client_id: 'test-client',
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

describe('getWorkflowFromHistory', () => {
  it('should fetch workflow from /history_v2/{prompt_id} endpoint', async () => {
    const mockFetchApi = vi.fn().mockResolvedValue({
      json: async () => mockHistoryResponse
    })

    await getWorkflowFromHistory(mockFetchApi, 'test-prompt-id')

    expect(mockFetchApi).toHaveBeenCalledWith('/history_v2/test-prompt-id')
  })

  it('should extract and return workflow from response', async () => {
    const mockFetchApi = vi.fn().mockResolvedValue({
      json: async () => mockHistoryResponse
    })

    const result = await getWorkflowFromHistory(mockFetchApi, 'test-prompt-id')

    expect(result).toEqual(mockWorkflow)
  })

  it('should return undefined when prompt_id not found in response', async () => {
    const mockFetchApi = vi.fn().mockResolvedValue({
      json: async () => ({})
    })

    const result = await getWorkflowFromHistory(mockFetchApi, 'nonexistent-id')

    expect(result).toBeUndefined()
  })

  it('should return undefined when workflow is missing from extra_pnginfo', async () => {
    const mockFetchApi = vi.fn().mockResolvedValue({
      json: async () => ({
        'test-prompt-id': {
          prompt: {
            priority: 1,
            prompt_id: 'test-prompt-id',
            extra_data: {
              client_id: 'test-client'
            }
          },
          outputs: {}
        }
      })
    })

    const result = await getWorkflowFromHistory(mockFetchApi, 'test-prompt-id')

    expect(result).toBeUndefined()
  })

  it('should handle fetch errors gracefully', async () => {
    const mockFetchApi = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await getWorkflowFromHistory(mockFetchApi, 'test-prompt-id')

    expect(result).toBeUndefined()
  })

  it('should handle malformed JSON responses', async () => {
    const mockFetchApi = vi.fn().mockResolvedValue({
      json: async () => {
        throw new Error('Invalid JSON')
      }
    })

    const result = await getWorkflowFromHistory(mockFetchApi, 'test-prompt-id')

    expect(result).toBeUndefined()
  })
})
