import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '../fixtures/ComfyPage'
import { webSocketFixture } from '../fixtures/ws'
import {
  ExecutionTestHelper,
  SubgraphTestHelper
} from '../helpers/ExecutionTestHelper'

const test = mergeTests(comfyPageFixture, webSocketFixture)

test.describe('Subgraph Execution Progress', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000) // Increase timeout for subgraph tests

  let executionHelper: ExecutionTestHelper
  let subgraphHelper: SubgraphTestHelper

  test.beforeEach(async ({ comfyPage }) => {
    executionHelper = new ExecutionTestHelper(comfyPage.page)
    subgraphHelper = new SubgraphTestHelper(comfyPage.page)
    // Share the same test ID to access the same window properties
    subgraphHelper.setTestId(executionHelper.getTestId())
  })

  test.afterEach(async () => {
    if (executionHelper) {
      await executionHelper.cleanup()
    }
  })

  test('Shows progress for nodes inside subgraphs', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/nested-subgraph-test')

    // Get reference to the subgraph node
    const subgraphNode = await comfyPage.getNodeRefById(10)
    expect(subgraphNode).toBeDefined()

    // Set up tracking for progress events
    await executionHelper.setupEventTracking()

    // Start real execution using command to avoid click issues
    await comfyPage.executeCommand('Comfy.QueuePrompt')

    // Wait for execution to start
    await executionHelper.waitForExecutionStart()

    // Wait for real progress events from subgraph execution
    await subgraphHelper.waitForNestedNodeProgress(1)

    // Wait for progress to be applied to the subgraph node
    await executionHelper.waitForGraphNodeProgress([10])

    // Check that the subgraph node shows aggregated progress
    const subgraphProgress = await subgraphNode.getProperty('progress')

    // The progress should be aggregated from child nodes
    expect(subgraphProgress).toBeDefined()
    expect(subgraphProgress).toBeGreaterThan(0)
    expect(subgraphProgress).toBeLessThanOrEqual(1)

    // Wait for stroke style to be applied
    await comfyPage.page.waitForFunction(
      (nodeId) => {
        const node = window['app'].graph.getNodeById(nodeId)
        if (!node?.strokeStyles?.['running']) return false
        const style = node.strokeStyles['running'].call(node)
        return style?.color === '#0f0'
      },
      10,
      { timeout: 5000 }
    )

    // Check stroke style
    const strokeStyle = await comfyPage.page.evaluate((nodeId) => {
      const node = window['app'].graph.getNodeById(nodeId)
      if (!node || !node.strokeStyles || !node.strokeStyles['running']) {
        return null
      }
      return node.strokeStyles['running'].call(node)
    }, 10)

    expect(strokeStyle).toEqual({ color: '#0f0' })
  })

  test('Handles deeply nested subgraph execution', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/nested-subgraph-test')

    // Set up tracking for progress events
    await executionHelper.setupEventTracking()

    // Start real execution using command to avoid click issues
    await comfyPage.executeCommand('Comfy.QueuePrompt')

    // Wait for execution to start
    await executionHelper.waitForExecutionStart()

    // Wait for real progress events from deeply nested subgraph execution
    await subgraphHelper.waitForNestedNodeProgress(2)

    // Wait for progress to be applied to the top-level subgraph node
    await executionHelper.waitForGraphNodeProgress([10])

    // Check that top-level subgraph shows progress
    const subgraphNode = await comfyPage.getNodeRefById(10)
    const progress = await subgraphNode.getProperty('progress')

    expect(progress).toBeDefined()
    expect(progress).toBeGreaterThan(0)
    expect(progress).toBeLessThanOrEqual(1)
  })

  test('Shows running state for parent nodes when child executes', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/nested-subgraph-test')

    // Track which nodes have running stroke style
    const getRunningNodes = async () => {
      return await comfyPage.page.evaluate(() => {
        const runningNodes: number[] = []
        const nodes = window['app'].graph.nodes

        for (const node of nodes) {
          if (
            node.strokeStyles?.['running'] &&
            node.strokeStyles['running'].call(node)?.color === '#0f0'
          ) {
            runningNodes.push(node.id)
          }
        }

        return runningNodes
      })
    }

    // Wait for any existing execution to complete
    await comfyPage.page
      .waitForFunction(
        () => {
          const nodes = window['app'].graph.nodes
          for (const node of nodes) {
            if (
              node.strokeStyles?.['running'] &&
              node.strokeStyles['running'].call(node)?.color === '#0f0'
            ) {
              return false
            }
          }
          return true
        },
        { timeout: 10000 }
      )
      .catch(() => {
        // If timeout, continue anyway
      })

    // Initially no nodes should be running
    let runningNodes = await getRunningNodes()
    expect(runningNodes).toHaveLength(0)

    // Set up tracking for progress events
    await executionHelper.setupEventTracking()

    // Start real execution using command to avoid click issues
    await comfyPage.executeCommand('Comfy.QueuePrompt')

    // Wait for execution to start
    await executionHelper.waitForExecutionStart()

    // Wait for real nested node execution progress
    await subgraphHelper.waitForNestedNodeProgress(1)

    // Wait for parent subgraph to show as running
    await comfyPage.page.waitForFunction(
      (nodeId) => {
        const node = window['app'].graph.getNodeById(nodeId)
        if (!node?.strokeStyles?.['running']) return false
        const style = node.strokeStyles['running'].call(node)
        return style?.color === '#0f0'
      },
      10,
      { timeout: 5000 }
    )

    // Parent subgraph should show as running
    runningNodes = await getRunningNodes()
    expect(runningNodes).toContain(10)

    // Wait for the execution to complete naturally
    const testId = executionHelper.getTestId()
    await comfyPage.page.waitForFunction(
      (testId) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        // Check if execution is finished (no more running nodes)
        const latestState = states[states.length - 1]
        if (!latestState.nodes) return false

        const runningNodes = Object.values(latestState.nodes).filter(
          (node: any) => node.state === 'running'
        ).length

        return runningNodes === 0
      },
      testId,
      { timeout: 10000 }
    )

    // Add a small delay to ensure UI updates
    await comfyPage.page.waitForTimeout(500)

    // Wait for parent subgraph to no longer be running
    await comfyPage.page.waitForFunction(
      (nodeId) => {
        const node = window['app'].graph.getNodeById(nodeId)
        if (!node?.strokeStyles?.['running']) return true
        const style = node.strokeStyles['running'].call(node)
        return style?.color !== '#0f0'
      },
      10,
      { timeout: 5000 }
    )

    // Parent should no longer be running
    runningNodes = await getRunningNodes()
    expect(runningNodes).not.toContain(10)
  })
})
