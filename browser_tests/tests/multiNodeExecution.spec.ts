import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '../fixtures/ComfyPage'
import { webSocketFixture } from '../fixtures/ws'
import {
  ExecutionTestHelper,
  PreviewTestHelper
} from '../helpers/ExecutionTestHelper'

const test = mergeTests(comfyPageFixture, webSocketFixture)

test.describe('Multi-node Execution Progress', () => {
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

  test('Can track progress of multiple async nodes executing in parallel', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Get references to the async nodes
    const sleepNode1 = await comfyPage.getNodeRefById(2)
    const sleepNode2 = await comfyPage.getNodeRefById(3)
    const progressNode = await comfyPage.getNodeRefById(4)

    // Verify nodes are present
    expect(sleepNode1).toBeDefined()
    expect(sleepNode2).toBeDefined()
    expect(progressNode).toBeDefined()

    // Set up tracking for progress events
    await executionHelper.setupEventTracking()

    // Start execution
    await comfyPage.queueButton.click()

    // Wait for all three nodes (2, 3, 4) to show progress from real execution
    const testId = executionHelper.getTestId()
    await comfyPage.page.waitForFunction(
      (testId) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        const latestState = states[states.length - 1]
        if (!latestState.nodes) return false

        const node2 = latestState.nodes['2']
        const node3 = latestState.nodes['3']
        const node4 = latestState.nodes['4']

        // Check that all nodes have started executing
        return (
          node2 &&
          node2.state === 'running' &&
          node3 &&
          node3.state === 'running' &&
          node4 &&
          node4.state === 'running'
        )
      },
      testId,
      { timeout: 10000 }
    )

    // Wait for progress to be applied to all nodes in the graph
    await executionHelper.waitForGraphNodeProgress([2, 3, 4])

    // Check that all nodes show progress
    const nodeProgress1 = await sleepNode1.getProperty('progress')
    const nodeProgress2 = await sleepNode2.getProperty('progress')
    const nodeProgress3 = await progressNode.getProperty('progress')

    // Progress values should now be defined (exact values depend on timing)
    expect(nodeProgress1).toBeDefined()
    expect(nodeProgress2).toBeDefined()
    expect(nodeProgress3).toBeDefined()
    expect(nodeProgress1).toBeGreaterThanOrEqual(0)
    expect(nodeProgress1).toBeLessThanOrEqual(1)
    expect(nodeProgress2).toBeGreaterThanOrEqual(0)
    expect(nodeProgress2).toBeLessThanOrEqual(1)
    expect(nodeProgress3).toBeGreaterThanOrEqual(0)
    expect(nodeProgress3).toBeLessThanOrEqual(1)

    // Wait for at least one node to finish
    await executionHelper.waitForNodeFinish()

    // Wait for the finished node's progress to be cleared
    const testId2 = executionHelper.getTestId()
    await comfyPage.page.waitForFunction(
      (testId) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        const latestState = states[states.length - 1]
        if (!latestState.nodes) return false

        // Find which nodes are finished
        const finishedNodeIds = Object.entries(latestState.nodes)
          .filter(([_, node]: [string, any]) => node.state === 'finished')
          .map(([id, _]) => id)

        // Check that finished nodes have no progress in the graph
        return finishedNodeIds.some((id) => {
          const node = window['app'].graph.getNodeById(parseInt(id))
          return node && node.progress === undefined
        })
      },
      testId2,
      { timeout: 5000 }
    )

    // Get current state of nodes
    const testId3 = executionHelper.getTestId()
    const currentState = await comfyPage.page.evaluate((testId) => {
      const states = window[`__progressStates_${testId}`]
      if (!states || states.length === 0) return null
      const latestState = states[states.length - 1]
      const graphNodes = {
        '2': window['app'].graph.getNodeById(2),
        '3': window['app'].graph.getNodeById(3),
        '4': window['app'].graph.getNodeById(4)
      }

      return {
        stateNodes: latestState.nodes,
        graphProgress: {
          '2': graphNodes['2']?.progress,
          '3': graphNodes['3']?.progress,
          '4': graphNodes['4']?.progress
        }
      }
    }, testId3)

    // Verify that finished nodes have no progress, running nodes have progress
    if (currentState && currentState.stateNodes) {
      Object.entries(currentState.stateNodes).forEach(
        ([nodeId, nodeState]: [string, any]) => {
          const graphProgress = currentState.graphProgress[nodeId]
          if (nodeState.state === 'finished') {
            expect(graphProgress).toBeUndefined()
          } else if (nodeState.state === 'running') {
            expect(graphProgress).toBeDefined()
            expect(graphProgress).toBeGreaterThanOrEqual(0)
            expect(graphProgress).toBeLessThanOrEqual(1)
          }
        }
      )
    }

    // Clean up by canceling execution
  })

  test('Updates visual state for multiple executing nodes', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Wait for the graph to be properly initialized
    await comfyPage.page.waitForFunction(
      () => {
        return window['app']?.graph?.nodes?.length > 0
      },
      { timeout: 5000 }
    )

    // Set up tracking for progress events
    await executionHelper.setupEventTracking()

    // Start execution
    await comfyPage.queueButton.click()

    // Wait for multiple nodes to start executing
    await executionHelper.waitForRunningNodes(2)

    // Wait for the progress to be applied to nodes
    await executionHelper.waitForGraphNodeProgress([2, 3])

    // Verify that nodes have progress set (indicates they are executing)
    const nodeStates = await comfyPage.page.evaluate(() => {
      const node2 = window['app'].graph.getNodeById(2)
      const node3 = window['app'].graph.getNodeById(3)
      return {
        node2Progress: node2?.progress,
        node3Progress: node3?.progress,
        // Check if any nodes are marked as running by having progress
        hasRunningNodes:
          (node2?.progress !== undefined && node2?.progress >= 0) ||
          (node3?.progress !== undefined && node3?.progress >= 0)
      }
    })

    expect(nodeStates.node2Progress).toBeDefined()
    expect(nodeStates.node3Progress).toBeDefined()
    expect(nodeStates.hasRunningNodes).toBe(true)

    // Wait for at least one node to finish
    await executionHelper.waitForNodeFinish()

    // Wait for progress updates to reflect the finished state
    const testId4 = executionHelper.getTestId()
    await comfyPage.page.waitForFunction(
      (testId) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        const latestState = states[states.length - 1]
        if (!latestState.nodes) return false

        // Find nodes by their state
        const finishedNodes = Object.entries(latestState.nodes)
          .filter(([_, node]: [string, any]) => node.state === 'finished')
          .map(([id, _]) => parseInt(id))

        const runningNodes = Object.entries(latestState.nodes)
          .filter(([_, node]: [string, any]) => node.state === 'running')
          .map(([id, _]) => parseInt(id))

        // Check graph nodes match the state
        const allFinishedCorrect = finishedNodes.every((id) => {
          const node = window['app'].graph.getNodeById(id)
          return node && node.progress === undefined
        })

        const allRunningCorrect = runningNodes.every((id) => {
          const node = window['app'].graph.getNodeById(id)
          return node && node.progress !== undefined && node.progress >= 0
        })

        return (
          allFinishedCorrect && allRunningCorrect && finishedNodes.length > 0
        )
      },
      testId4,
      { timeout: 5000 }
    )

    // Verify the final node states
    const testId5 = executionHelper.getTestId()
    const finalNodeStates = await comfyPage.page.evaluate((testId) => {
      const states = window[`__progressStates_${testId}`]
      if (!states || states.length === 0) return null
      const latestState = states[states.length - 1]
      const node2 = window['app'].graph.getNodeById(2)
      const node3 = window['app'].graph.getNodeById(3)

      return {
        node2State: latestState.nodes['2']?.state,
        node3State: latestState.nodes['3']?.state,
        node2Progress: node2?.progress,
        node3Progress: node3?.progress
      }
    }, testId5)

    // Verify finished nodes have no progress, running nodes have progress
    if (finalNodeStates) {
      if (finalNodeStates.node2State === 'finished') {
        expect(finalNodeStates.node2Progress).toBeUndefined()
      } else if (finalNodeStates.node2State === 'running') {
        expect(finalNodeStates.node2Progress).toBeDefined()
      }

      if (finalNodeStates.node3State === 'finished') {
        expect(finalNodeStates.node3Progress).toBeUndefined()
      } else if (finalNodeStates.node3State === 'running') {
        expect(finalNodeStates.node3Progress).toBeDefined()
      }
    }
  })

  test('Clears previews when nodes start executing', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Initialize tracking for revoked previews
    await comfyPage.page.evaluate(() => {
      window['__revokedNodes'] = []
    })

    // Set up some fake previews
    await comfyPage.page.evaluate(() => {
      window['app'].nodePreviewImages['2'] = ['fake-preview-url-1']
      window['app'].nodePreviewImages['3'] = ['fake-preview-url-2']
    })

    // Verify previews exist
    const previewsBefore = await comfyPage.page.evaluate(() => {
      return {
        node2: window['app'].nodePreviewImages['2'],
        node3: window['app'].nodePreviewImages['3']
      }
    })

    expect(previewsBefore.node2).toEqual(['fake-preview-url-1'])
    expect(previewsBefore.node3).toEqual(['fake-preview-url-2'])

    // Mock revokePreviews to track calls and set up event listeners
    await previewHelper.setupPreviewTracking()
    await executionHelper.setupEventTracking()

    // Start real execution using command
    await comfyPage.executeCommand('Comfy.QueuePrompt')

    // Wait for execution to start
    await executionHelper.waitForExecutionStart()

    // Wait for real execution to trigger progress events that clear previews
    const testId6 = executionHelper.getTestId()
    await comfyPage.page.waitForFunction(
      (testId) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        // Check if we have progress for nodes 2 and 3
        const hasNode2Progress = states.some(
          (state: any) =>
            state.nodes &&
            state.nodes['2'] &&
            state.nodes['2'].state === 'running'
        )
        const hasNode3Progress = states.some(
          (state: any) =>
            state.nodes &&
            state.nodes['3'] &&
            state.nodes['3'].state === 'running'
        )

        return hasNode2Progress && hasNode3Progress
      },
      testId6,
      { timeout: 10000 }
    )

    // Wait for the event to be processed and previews to be revoked
    await comfyPage.page.waitForFunction(
      () => {
        const revokedNodes = window['__revokedNodes']
        const node2PreviewCleared =
          window['app'].nodePreviewImages['2'] === undefined
        const node3PreviewCleared =
          window['app'].nodePreviewImages['3'] === undefined

        return (
          revokedNodes.includes('2') &&
          revokedNodes.includes('3') &&
          node2PreviewCleared &&
          node3PreviewCleared
        )
      },
      { timeout: 5000 }
    )

    // Check that revokePreviews was called for both nodes
    const revokedNodes = await previewHelper.getRevokedNodes()
    expect(revokedNodes).toContain('2')
    expect(revokedNodes).toContain('3')

    // Check that previews were cleared
    const previewsAfter = await comfyPage.page.evaluate(() => {
      return {
        node2: window['app'].nodePreviewImages['2'],
        node3: window['app'].nodePreviewImages['3']
      }
    })

    expect(previewsAfter.node2).toBeUndefined()
    expect(previewsAfter.node3).toBeUndefined()
  })
})
