import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Workflow failure recovery', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Sidebar'
    )

    await comfyPage.page.route('**/api/userdata/**', async (route) => {
      const request = route.request()
      const path = decodeURIComponent(new URL(request.url()).pathname)

      if (
        request.method() === 'GET' &&
        (path.endsWith('/userdata/workflows/unavailable.json') ||
          path.endsWith('/userdata/workflows/boot-failure.json'))
      ) {
        await route.fulfill({ status: 503 })
        return
      }
      if (
        request.method() === 'GET' &&
        path.endsWith('/userdata/workflows/malformed.json')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{invalid'
        })
        return
      }
      if (
        request.method() === 'POST' &&
        path.endsWith(
          '/userdata/workflows/rename.json/move/workflows/renamed.json'
        )
      ) {
        await route.fulfill({ status: 500 })
        return
      }
      if (
        request.method() === 'DELETE' &&
        path.endsWith('/userdata/workflows/delete.json')
      ) {
        await route.fulfill({ status: 500 })
        return
      }

      await route.fallback()
    })

    await comfyPage.workflow.setupWorkflowsDirectory({
      'stable.json': 'nodes/single_ksampler.json',
      'configure-failure.json': 'default.json',
      'unavailable.json': 'default.json',
      'boot-failure.json': 'default.json',
      'malformed.json': 'default.json',
      'rename.json': 'default.json',
      'delete.json': 'default.json'
    })
    await comfyPage.menu.workflowsTab.open()
  })

  test.afterEach(async ({ comfyPage }) => {
    const appReady = await comfyPage.page.evaluate(
      () => window.app?.extensionManager !== undefined
    )
    if (!appReady) return
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('keeps the active workflow when another workflow is unavailable', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.getPersistedItem('stable').click()
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)

    await tab.getPersistedItem('unavailable').click()
    await comfyPage.workflow.waitForWorkflowIdle()

    expect(await tab.getActiveWorkflowName()).toBe('stable')
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
    expect(await tab.getOpenedWorkflowNames()).not.toContain('unavailable')
  })

  test('keeps the active workflow when another workflow is malformed', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.getPersistedItem('stable').click()
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)

    await tab.getPersistedItem('malformed').click()
    await comfyPage.workflow.waitForWorkflowIdle()

    expect(await tab.getActiveWorkflowName()).toBe('stable')
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
    expect(await tab.getOpenedWorkflowNames()).not.toContain('malformed')
  })

  test('restores the active workflow when graph configuration fails', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.getPersistedItem('stable').click()
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
    await comfyPage.page.evaluate(() => {
      ;(window.graph as { configure: () => void }).configure = () => {
        throw new Error('Configure failed')
      }
    })

    await tab.getPersistedItem('configure-failure').click()
    await comfyPage.workflow.waitForWorkflowIdle()

    expect(await tab.getActiveWorkflowName()).toBe('stable')
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
  })

  test('keeps the workflow name when its rename request fails', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.getPersistedItem('rename').click()

    await tab.renameWorkflow(tab.getOpenedItem('rename'), 'renamed')

    await expect(tab.getOpenedItem('rename')).toBeVisible()
    await expect(tab.getOpenedItem('renamed')).toBeHidden()

    test.fail(true, 'A failed workflow rename has no specific error message')
    await expect(comfyPage.toast.toastErrors).toContainText(
      'Failed to rename workflow. Please try again.',
      { timeout: 1000 }
    )
  })

  test('keeps a workflow in the sidebar when deletion fails', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    const workflow = tab.getPersistedItem('delete')
    await workflow.click({ button: 'right' })
    await comfyPage.contextMenu.clickMenuItem('Delete')
    await comfyPage.confirmDialog.delete.click()

    await expect(workflow).toBeVisible()
    await expect(comfyPage.toast.visibleToasts).not.toContainText(
      'Workflow deleted'
    )
  })

  test('does not insert a workflow when its source cannot be loaded', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    const originalNodeCount = await comfyPage.nodeOps.getNodeCount()

    await tab.insertWorkflow(tab.getPersistedItem('unavailable'))

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(originalNodeCount)
  })

  test('does not duplicate a workflow when its source cannot be loaded', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    const originalNames = await tab.getOpenedWorkflowNames()
    await tab.getPersistedItem('unavailable').click({ button: 'right' })

    await comfyPage.contextMenu.clickMenuItem('Duplicate')

    await expect.poll(() => tab.getOpenedWorkflowNames()).toEqual(originalNames)
  })

  test.describe('startup recovery', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
      await comfyPage.menu.workflowsTab.getPersistedItem('stable').click()
      await comfyPage.page.evaluate(() => {
        window.app!.graph.add(
          window.LiteGraph!.createNode('Note', undefined, {})
        )
        const workflow = window.app!.extensionManager.workflow.activeWorkflow
        workflow?.changeTracker.captureCanvasState()
      })
      await comfyPage.workflow.waitForDraftPersisted()
      await comfyPage.page.evaluate(() => {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (!key?.startsWith('Comfy.Workflow.ActivePath:')) continue

          const pointer = JSON.parse(sessionStorage.getItem(key)!) as {
            path: string
          }
          pointer.path = 'workflows/boot-failure.json'
          sessionStorage.setItem(key, JSON.stringify(pointer))
          return
        }
        throw new Error('Missing active workflow persistence key')
      })
    })

    test('falls back to the latest valid draft', async ({ comfyPage }) => {
      test.slow()
      await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })

      test.fail(
        true,
        'Startup stops after the saved active workflow fails to load'
      )
      await expect(comfyPage.menu.workflowsTab.activeWorkflowLabel).toHaveText(
        'stable',
        { timeout: 5000 }
      )
      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(2)
    })
  })
})
