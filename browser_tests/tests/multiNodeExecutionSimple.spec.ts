import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '../fixtures/ComfyPage'
import { webSocketFixture } from '../fixtures/ws'
import {
  ExecutionTestHelper,
  PreviewTestHelper
} from '../helpers/ExecutionTestHelper'

const test = mergeTests(comfyPageFixture, webSocketFixture)

test.describe('Multi-node Execution Progress - Simple', () => {
  test.describe.configure({ mode: 'serial' })

  let executionHelper: ExecutionTestHelper
  let previewHelper: PreviewTestHelper

  test.beforeEach(async ({ comfyPage }) => {
    executionHelper = new ExecutionTestHelper(comfyPage.page)
    previewHelper = new PreviewTestHelper(comfyPage.page)
  })

  test.afterEach(async () => {
    if (executionHelper) {
      await executionHelper.cleanup()
    }
  })

  test('Can dispatch and receive progress_state events', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Set up event tracking
    await executionHelper.setupEventTracking()

    // Start real execution
    await comfyPage.queueButton.click()

    // Wait for real progress_state events from backend
    const testId = executionHelper.getTestId()
    await comfyPage.page.waitForFunction(
      (testId) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        const latestState = states[states.length - 1]
        return latestState.nodes && Object.keys(latestState.nodes).length > 0
      },
      testId,
      { timeout: 10000 }
    )

    // Get the captured states
    const eventState = await executionHelper.getEventState()
    const result = eventState.progressStates

    // Should have captured real events
    expect(result.length).toBeGreaterThan(0)
    const firstState = result[0]
    expect(firstState).toBeDefined()
    expect(firstState.prompt_id).toBeDefined()
    expect(firstState.nodes).toBeDefined()

    // Check that we got real node progress
    const nodeIds = Object.keys(firstState.nodes)
    expect(nodeIds.length).toBeGreaterThan(0)

    // Verify node structure
    for (const nodeId of nodeIds) {
      const node = firstState.nodes[nodeId]
      expect(node.state).toBeDefined()
      expect(node.node_id).toBeDefined()
      expect(node.display_node_id).toBeDefined()
      expect(node.prompt_id).toBeDefined()
    }
  })

  test('Canvas updates when nodes have progress', async ({ comfyPage, ws }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Set up progress tracking
    await executionHelper.setupEventTracking()

    // Start real execution
    await comfyPage.queueButton.click()

    // Wait for nodes to have progress from real execution
    const testId2 = executionHelper.getTestId()
    await comfyPage.page.waitForFunction(
      (testId) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        const latestState = states[states.length - 1]
        if (!latestState.nodes) return false

        // Check if any nodes are running with progress
        const runningNodes = Object.values(latestState.nodes).filter(
          (node: any) => node.state === 'running' && node.value > 0
        )

        return runningNodes.length > 0
      },
      testId2,
      { timeout: 10000 }
    )

    // Wait for progress to be applied to graph nodes
    await executionHelper.waitForGraphNodeProgress([2, 3, 4])

    // Check that nodes have progress set from real execution
    const node2Progress = await executionHelper.getGraphNodeProgress(2)
    const node3Progress = await executionHelper.getGraphNodeProgress(3)
    const node4Progress = await executionHelper.getGraphNodeProgress(4)

    // At least one node should have progress
    const hasProgress =
      (node2Progress !== undefined && node2Progress > 0) ||
      (node3Progress !== undefined && node3Progress > 0) ||
      (node4Progress !== undefined && node4Progress > 0)

    expect(hasProgress).toBe(true)
  })

  test('Preview events include metadata', async ({ comfyPage, ws }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Track preview events
    await previewHelper.setupPreviewTracking()
    await executionHelper.setupEventTracking()

    // Start real execution using command
    await comfyPage.executeCommand('Comfy.QueuePrompt')

    // Wait for execution to start
    await executionHelper.waitForExecutionStart()

    // For this test, we'll check the event structure by simulating one
    // since real preview events depend on the workflow actually generating images
    await comfyPage.page.evaluate(() => {
      const api = window['app'].api
      // Simulate a preview event that would come from backend
      api.dispatchCustomEvent('b_preview_with_metadata', {
        blob: new Blob(['test'], { type: 'image/png' }),
        nodeId: '10:5:3',
        displayNodeId: '10',
        parentNodeId: '10:5',
        realNodeId: '3',
        promptId: 'test-prompt-id'
      })
    })

    await comfyPage.nextFrame()

    // Check captured events
    const captured = await previewHelper.getPreviewEvents()
    expect(captured).toHaveLength(1)
    expect(captured[0]).toEqual({
      nodeId: '10:5:3',
      displayNodeId: '10',
      parentNodeId: '10:5',
      realNodeId: '3',
      promptId: 'test-prompt-id'
    })
  })
})
