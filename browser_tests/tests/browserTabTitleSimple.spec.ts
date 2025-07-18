import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import {
  BrowserTitleMonitor,
  ExecutionTestHelper
} from '../helpers/ExecutionTestHelper'

test.describe('Browser Tab Title - Multi-node Simple', () => {
  test.describe.configure({ mode: 'serial' })

  let executionHelper: ExecutionTestHelper
  let titleMonitor: BrowserTitleMonitor

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    executionHelper = new ExecutionTestHelper(comfyPage.page)
    titleMonitor = new BrowserTitleMonitor(comfyPage.page)
  })

  test.afterEach(async () => {
    if (executionHelper) {
      await executionHelper.cleanup()
    }
  })

  test('Title updates based on execution state', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Wait for any existing execution to complete
    await titleMonitor.waitForIdleTitle().catch(() => {
      // If timeout, cancel any running execution
      return comfyPage.page.keyboard.press('Escape')
    })

    // Get initial title
    const initialTitle = await comfyPage.page.title()
    // Title might show execution state if other tests are running
    // Just ensure we can detect when it changes
    const hasExecutionState =
      initialTitle.match(/\[\d+%\]/) ||
      initialTitle.match(/\[\d+ nodes running\]/)

    // Set up tracking for execution events
    await executionHelper.setupEventTracking()

    // Start real execution using command instead of button
    await comfyPage.executeCommand('Comfy.QueuePrompt')

    // Wait for execution to start
    await executionHelper.waitForExecutionStart()

    // Wait for title to update with execution state
    await titleMonitor.waitForExecutionTitle()

    const executingTitle = await comfyPage.page.title()
    // If initial title didn't have execution state, it should be different now
    if (!hasExecutionState) {
      expect(executingTitle).not.toBe(initialTitle)
    }
    expect(executingTitle).toMatch(/\[[\d%\s\w]+\]/)
  })

  test('Can read workflow name from title', async ({ comfyPage }) => {
    // Wait for any existing execution to complete
    await titleMonitor.waitForIdleTitle(5000).catch(async () => {
      // Cancel any running execution
      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.page.waitForTimeout(1000)
    })

    // Set a workflow name
    await comfyPage.page.evaluate(() => {
      window['app'].extensionManager.workflow.activeWorkflow.filename =
        'test-workflow'
    })

    // Wait for title to update
    await comfyPage.page.waitForTimeout(100)

    const title = await comfyPage.page.title()
    expect(title).toContain('test-workflow')
    // Title should contain workflow name regardless of execution state
  })
})
