import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '../fixtures/ComfyPage'
import { webSocketFixture } from '../fixtures/ws'
import {
  BrowserTitleMonitor,
  ExecutionTestHelper
} from '../helpers/ExecutionTestHelper'

const test = mergeTests(comfyPageFixture, webSocketFixture)

test.describe('Browser Tab Title - Multi-node Execution', () => {
  test.describe.configure({ mode: 'serial' })

  let executionHelper: ExecutionTestHelper
  let titleMonitor: BrowserTitleMonitor

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    executionHelper = new ExecutionTestHelper(comfyPage.page)
    titleMonitor = new BrowserTitleMonitor(comfyPage.page)
  })

  test.afterEach(async () => {
    // Clean up event listeners to avoid conflicts
    if (executionHelper) {
      await executionHelper.cleanup()
    }
  })

  test('Shows multiple nodes running in tab title', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Wait for any existing execution to complete
    await titleMonitor.waitForIdleTitle()

    // Get initial title
    const initialTitle = await comfyPage.page.title()
    // Title might show execution state if other tests are running
    // Just ensure we have a baseline to compare against

    // Wait for the UI to be ready
    await comfyPage.nextFrame()

    // Check if workflow is valid and nodes are available
    const workflowStatus = await comfyPage.page.evaluate(() => {
      const graph = window['app'].graph
      const missingNodeTypes: string[] = []
      const nodeCount = graph.nodes.length

      // Check for missing node types
      graph.nodes.forEach((node: any) => {
        if (node.type && !LiteGraph.registered_node_types[node.type]) {
          missingNodeTypes.push(node.type)
        }
      })

      return {
        nodeCount,
        missingNodeTypes,
        hasErrors: missingNodeTypes.length > 0
      }
    })

    if (workflowStatus.hasErrors) {
      console.log('Missing node types:', workflowStatus.missingNodeTypes)
      // Skip test if nodes are missing
      test.skip()
      return
    }

    // Set up tracking for progress events and errors
    await executionHelper.setupEventTracking()

    // Queue the workflow for real execution using the command
    await comfyPage.executeCommand('Comfy.QueuePrompt')

    // Wait a moment to see if there's an error
    await comfyPage.page.waitForTimeout(1000)

    // Check for execution errors
    if (await executionHelper.hasExecutionError()) {
      const error = await executionHelper.getExecutionError()
      console.log('Execution error:', error)
    }

    // Wait for multiple nodes to be running (TestSleep nodes 2, 3 and TestAsyncProgressNode 4)
    await executionHelper.waitForRunningNodes(2)

    // Check title while we know multiple nodes are running
    const testId = executionHelper.getTestId()
    const titleDuringExecution = await comfyPage.page.evaluate((testId) => {
      const states = window[`__progressStates_${testId}`]
      if (!states || states.length === 0) return null

      const latestState = states[states.length - 1]
      if (!latestState.nodes) return null

      const runningNodes = Object.values(latestState.nodes).filter(
        (node: any) => node.state === 'running'
      ).length

      return {
        title: document.title,
        runningCount: runningNodes
      }
    }, testId)

    // Verify we captured the state with multiple nodes running
    expect(titleDuringExecution).not.toBeNull()
    expect(titleDuringExecution.runningCount).toBeGreaterThanOrEqual(2)

    // The title should show multiple nodes running when we have 2+ nodes executing
    if (titleDuringExecution.runningCount >= 2) {
      expect(titleDuringExecution.title).toMatch(/\[\d+ nodes running\]/)
    }

    // Wait for some nodes to finish, leaving only one running
    await executionHelper.waitForRunningNodes(1, 15000)

    // Wait for title to show single node progress
    await comfyPage.page.waitForFunction(
      () => {
        const title = document.title
        return title.match(/\[\d+%\]/) && !title.match(/\[\d+ nodes running\]/)
      },
      { timeout: 5000 }
    )

    // Check that title shows single node with progress
    const titleWithSingleNode = await comfyPage.page.title()
    expect(titleWithSingleNode).toMatch(/\[\d+%\]/)
    expect(titleWithSingleNode).not.toMatch(/\[\d+ nodes running\]/)
  })

  test('Shows progress updates in title during execution', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Wait for the UI to be ready
    await comfyPage.nextFrame()

    // Set up tracking for progress events and title changes
    await executionHelper.setupEventTracking()
    await titleMonitor.setupTitleMonitoring()

    // Queue the workflow for real execution using the command
    await comfyPage.executeCommand('Comfy.QueuePrompt')

    // Wait for TestAsyncProgressNode (node 4) to start showing progress
    // This node reports progress from 0 to 10 with steps of 1
    const testId2 = executionHelper.getTestId()
    await comfyPage.page.waitForFunction(
      (testId) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        const latestState = states[states.length - 1]
        if (!latestState.nodes || !latestState.nodes['4']) return false

        const node4 = latestState.nodes['4']
        if (node4.state === 'running' && node4.value > 0) {
          window['__lastProgress'] = Math.round((node4.value / node4.max) * 100)
          return true
        }
        return false
      },
      testId2,
      { timeout: 10000 }
    )

    // Wait for title to show progress percentage
    await comfyPage.page.waitForFunction(
      () => {
        const title = document.title
        console.log('Title check 1:', title)
        return title.match(/\[\d+%\]/)
      },
      { timeout: 5000 }
    )

    // Check that title shows a progress percentage
    const titleWithProgress = await comfyPage.page.title()
    expect(titleWithProgress).toMatch(/\[\d+%\]/)

    // Wait for progress to update to a different value
    const firstProgress = await comfyPage.page.evaluate(
      () => window['__lastProgress']
    )

    const testId3 = executionHelper.getTestId()
    await comfyPage.page.waitForFunction(
      ({ initialProgress, testId }) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        const latestState = states[states.length - 1]
        if (!latestState.nodes || !latestState.nodes['4']) return false

        const node4 = latestState.nodes['4']
        if (node4.state === 'running') {
          const currentProgress = Math.round((node4.value / node4.max) * 100)
          window['__lastProgress'] = currentProgress
          return currentProgress > initialProgress
        }
        return false
      },
      { initialProgress: firstProgress, testId: testId3 },
      { timeout: 10000 }
    )

    // Store the first progress for comparison
    await comfyPage.page.evaluate((progress) => {
      window['__firstProgress'] = progress
    }, firstProgress)

    // Check the title history to verify we captured progress updates
    const finalCheck = await comfyPage.page.evaluate(() => {
      const titleLog = window['__titleUpdateLog'] || []
      const firstProgress = window['__firstProgress'] || 0

      // Find titles with progress information
      const titlesWithProgress = titleLog.filter((entry) => entry.hasProgress)

      // Check if we saw different progress values or multi-node running state
      const progressValues = new Set()
      const hadMultiNodeRunning = titleLog.some((entry) =>
        entry.title.includes('nodes running')
      )

      titleLog.forEach((entry) => {
        const match = entry.title.match(/\[(\d+)%\]/)
        if (match) {
          progressValues.add(parseInt(match[1]))
        }
      })

      return {
        sawProgressUpdates: titlesWithProgress.length > 0,
        uniqueProgressValues: Array.from(progressValues),
        hadMultiNodeRunning,
        firstProgress,
        lastProgress: window['__lastProgress'],
        totalTitleUpdates: titleLog.length,
        sampleTitles: titleLog.slice(0, 5)
      }
    })

    console.log('Title update check:', JSON.stringify(finalCheck, null, 2))

    // Verify that we captured title updates showing execution progress
    expect(finalCheck.sawProgressUpdates).toBe(true)
    expect(finalCheck.totalTitleUpdates).toBeGreaterThan(0)

    // We should have seen either:
    // 1. Multiple unique progress values, OR
    // 2. Multi-node running state, OR
    // 3. Progress different from initial
    const sawProgressChange =
      finalCheck.uniqueProgressValues.length > 1 ||
      finalCheck.hadMultiNodeRunning ||
      finalCheck.lastProgress !== firstProgress

    expect(sawProgressChange).toBe(true)

    // Clean up interval
    await titleMonitor.stopTitleMonitoring()
  })

  test('Clears execution status from title when all nodes finish', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Wait for any existing execution to complete
    await titleMonitor.waitForIdleTitle()

    // Wait for the UI to be ready
    await comfyPage.nextFrame()

    // Set up tracking for events
    await executionHelper.setupEventTracking()

    // Queue the workflow for real execution using the command
    await comfyPage.executeCommand('Comfy.QueuePrompt')

    // Wait for execution to show progress in title
    await titleMonitor.waitForExecutionTitle()

    // Verify execution shows in title
    const executingTitle = await comfyPage.page.title()
    expect(executingTitle).toMatch(/\[[\d%\s\w]+\]/)

    // Wait for execution to complete (all nodes finished)
    await executionHelper.waitForExecutionFinish()

    // Give a moment for title to update after execution completes
    await comfyPage.page.waitForTimeout(500)

    // Wait for title to clear execution status
    await titleMonitor.waitForIdleTitle()

    // Check that execution status is cleared
    const finishedTitle = await comfyPage.page.title()
    expect(finishedTitle).toContain('ComfyUI')
    expect(finishedTitle).not.toMatch(/\[\d+%\]/) // No percentage
    expect(finishedTitle).not.toMatch(/\[\d+ nodes running\]/) // No running nodes
    expect(finishedTitle).not.toContain('Executing')
  })
})
