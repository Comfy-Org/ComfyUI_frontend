import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

test.describe('History API v2', () => {
  const TEST_PROMPT_ID = 'test-prompt-id'
  const TEST_CLIENT_ID = 'test-client'

  test('Can fetch history with new v2 format', async ({ comfyPage }) => {
    // Set up mocked history with tasks
    await comfyPage.setupHistory().withTask(['example.webp']).setupRoutes()

    // Verify history_v2 API response format
    const result = await comfyPage.page.evaluate(async () => {
      try {
        const response = await window['app'].api.getHistory()
        return { success: true, data: response }
      } catch (error) {
        console.error('Failed to fetch history:', error)
        return { success: false, error: error.message }
      }
    })

    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty('History')
    expect(Array.isArray(result.data.History)).toBe(true)
    expect(result.data.History.length).toBeGreaterThan(0)

    const historyItem = result.data.History[0]

    // Verify the new prompt structure (object instead of array)
    expect(historyItem.prompt).toHaveProperty('priority')
    expect(historyItem.prompt).toHaveProperty('prompt_id')
    expect(historyItem.prompt).toHaveProperty('extra_data')
    expect(typeof historyItem.prompt.priority).toBe('number')
    expect(typeof historyItem.prompt.prompt_id).toBe('string')
    expect(historyItem.prompt.extra_data).toHaveProperty('client_id')
  })

  test('Can load workflow from history using history_v2 endpoint', async ({
    comfyPage
  }) => {
    // Simple mock workflow for testing
    const mockWorkflow = {
      version: 0.4,
      nodes: [{ id: 1, type: 'TestNode', pos: [100, 100], size: [200, 100] }],
      links: [],
      groups: [],
      config: {},
      extra: {}
    }

    // Set up history with workflow data
    await comfyPage
      .setupHistory()
      .withTask(['example.webp'], 'images', {
        prompt: {
          priority: 0,
          prompt_id: TEST_PROMPT_ID,
          extra_data: {
            client_id: TEST_CLIENT_ID,
            extra_pnginfo: { workflow: mockWorkflow }
          }
        }
      })
      .setupRoutes()

    // Load initial workflow to clear canvas
    await comfyPage.loadWorkflow('simple_slider')
    await comfyPage.nextFrame()

    // Load workflow from history
    const loadResult = await comfyPage.page.evaluate(async (promptId) => {
      try {
        const workflow =
          await window['app'].api.getWorkflowFromHistory(promptId)
        if (workflow) {
          await window['app'].loadGraphData(workflow)
          return { success: true }
        }
        return { success: false, error: 'No workflow found' }
      } catch (error) {
        console.error('Failed to load workflow from history:', error)
        return { success: false, error: error.message }
      }
    }, TEST_PROMPT_ID)

    expect(loadResult.success).toBe(true)

    // Verify workflow loaded correctly
    await comfyPage.nextFrame()
    const nodeInfo = await comfyPage.page.evaluate(() => {
      try {
        const graph = window['app'].graph
        return {
          success: true,
          nodeCount: graph.nodes?.length || 0,
          firstNodeType: graph.nodes?.[0]?.type || null
        }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    expect(nodeInfo.success).toBe(true)
    expect(nodeInfo.nodeCount).toBe(1)
    expect(nodeInfo.firstNodeType).toBe('TestNode')
  })

  test('Handles missing workflow data gracefully', async ({ comfyPage }) => {
    // Set up empty history routes
    await comfyPage.setupHistory().setupRoutes()

    // Test loading from history with invalid prompt_id
    const result = await comfyPage.page.evaluate(async () => {
      try {
        const workflow =
          await window['app'].api.getWorkflowFromHistory('invalid-id')
        return { success: true, workflow }
      } catch (error) {
        console.error('Expected error for invalid prompt_id:', error)
        return { success: false, error: error.message }
      }
    })

    // Should handle gracefully without throwing
    expect(result.success).toBe(true)
    expect(result.workflow).toBeNull()
  })
})
