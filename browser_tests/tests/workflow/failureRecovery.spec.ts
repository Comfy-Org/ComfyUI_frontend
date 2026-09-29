import { expect } from '@playwright/test'

import type { ActivePathPointer } from '@/platform/workflow/persistence/base/draftTypes'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const workflowRequest =
  (method: string, name: string) =>
  (request: { method(): string; url(): string }) =>
    request.method() === method &&
    decodeURIComponent(new URL(request.url()).pathname).endsWith(
      `/userdata/workflows/${name}`
    )

test.describe('Workflow failure recovery', () => {
  test.use({
    initialSettings: { 'Comfy.Workflow.WorkflowTabsPosition': 'Sidebar' }
  })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.route('**/api/userdata/**', async (route) => {
      const request = route.request()
      const path = decodeURIComponent(new URL(request.url()).pathname)
      const failure = [
        {
          method: 'GET',
          suffix: '/userdata/workflows/unavailable.json',
          response: { status: 503 }
        },
        {
          method: 'GET',
          suffix: '/userdata/workflows/boot-failure.json',
          response: { status: 503 }
        },
        {
          method: 'GET',
          suffix: '/userdata/workflows/malformed.json',
          response: {
            status: 200,
            contentType: 'application/json',
            body: '{invalid'
          }
        },
        {
          method: 'POST',
          suffix: '/userdata/workflows/rename.json/move/workflows/renamed.json',
          response: { status: 500 }
        },
        {
          method: 'DELETE',
          suffix: '/userdata/workflows/delete.json',
          response: { status: 500 }
        }
      ].find(
        ({ method, suffix }) =>
          request.method() === method && path.endsWith(suffix)
      )

      if (failure) await route.fulfill(failure.response)
      else await route.fallback()
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
    const response = await comfyPage.request.post(
      `${comfyPage.url}/api/devtools/setup_folder_structure`,
      {
        data: {
          tree_structure: {},
          base_path: `user/${comfyPage.id}/workflows`
        }
      }
    )
    expect(response.ok()).toBe(true)
  })

  for (const { name, failure } of [
    { name: 'unavailable', failure: 'unavailable response' },
    { name: 'malformed', failure: 'malformed response' }
  ]) {
    test(`keeps the active workflow after an ${failure}`, async ({
      comfyPage
    }) => {
      const tab = comfyPage.menu.workflowsTab
      await tab.getPersistedItem('stable').click()
      await expect.poll(() => tab.getActiveWorkflowName()).toBe('stable')
      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
      const request = comfyPage.page.waitForRequest(
        workflowRequest('GET', `${name}.json`)
      )

      await tab.getPersistedItem(name).click()
      expect((await request).method()).toBe('GET')
      await comfyPage.workflow.waitForWorkflowIdle()

      expect(await tab.getActiveWorkflowName()).toBe('stable')
      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
      expect(await tab.getOpenedWorkflowNames()).not.toContain(name)
    })
  }

  test('restores the active workflow when graph configuration fails', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.getPersistedItem('stable').click()
    await expect.poll(() => tab.getActiveWorkflowName()).toBe('stable')
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
    await comfyPage.page.evaluate(() => {
      const graph = window.app?.rootGraph
      if (!graph) throw new Error('Missing graph')
      const configure = graph.configure.bind(graph)
      let failNextConfiguration = true
      graph.configure = (...args) => {
        if (!failNextConfiguration) return configure(...args)
        failNextConfiguration = false
        sessionStorage.setItem('failure-recovery:configure-ran', 'true')
        throw new Error('Configure failed')
      }
    })

    const request = comfyPage.page.waitForRequest(
      workflowRequest('GET', 'configure-failure.json')
    )
    await tab.getPersistedItem('configure-failure').click()
    expect((await request).method()).toBe('GET')
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() =>
          sessionStorage.getItem('failure-recovery:configure-ran')
        )
      )
      .toBe('true')
    test.fail(true, 'Graph configuration failure recovery is not implemented')
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
    const request = comfyPage.page.waitForRequest(
      workflowRequest('DELETE', 'delete.json')
    )
    await workflow.click({ button: 'right' })
    await comfyPage.contextMenu.clickMenuItem('Delete')
    await comfyPage.confirmDialog.delete.click()

    expect((await request).method()).toBe('DELETE')
    await expect(workflow).toBeVisible()
    await expect(
      comfyPage.toast.toastSuccesses.filter({ hasText: 'Workflow deleted' })
    ).toHaveCount(0)
  })

  test('does not insert a workflow when its source cannot be loaded', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    const originalNodeCount = await comfyPage.nodeOps.getNodeCount()
    const request = comfyPage.page.waitForRequest(
      workflowRequest('GET', 'unavailable.json')
    )

    await tab.insertWorkflow(tab.getPersistedItem('unavailable'))

    expect((await request).method()).toBe('GET')
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
    const request = comfyPage.page.waitForRequest(
      workflowRequest('GET', 'unavailable.json')
    )

    await comfyPage.contextMenu.clickMenuItem('Duplicate')

    expect((await request).method()).toBe('GET')
    await expect.poll(() => tab.getOpenedWorkflowNames()).toEqual(originalNames)
  })

  test.describe('startup recovery', () => {
    test.use({
      initialSettings: {
        'Comfy.Workflow.Persist': true,
        'Comfy.Workflow.WorkflowTabsPosition': 'Sidebar'
      }
    })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.menu.workflowsTab.getPersistedItem('stable').click()
      await expect
        .poll(() => comfyPage.menu.workflowsTab.getActiveWorkflowName())
        .toBe('stable')
      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
      await comfyPage.page.evaluate(() => {
        window.app!.graph.add(
          window.LiteGraph!.createNode('Note', undefined, {})
        )
        const workflow = window.app!.extensionManager.workflow.activeWorkflow
        workflow?.changeTracker.captureCanvasState()
      })
      await comfyPage.workflow.waitForDraftPersisted()
      const clientId = await comfyPage.page.evaluate(
        () => window.app!.api.clientId
      )
      expect(clientId).toBeTruthy()
      if (!clientId) throw new Error('Missing API client ID')
      await comfyPage.page.evaluate(
        ({ activePathKey, failedPath }) => {
          const storedPointer: unknown = JSON.parse(
            sessionStorage.getItem(activePathKey) ?? 'null'
          )
          if (
            typeof storedPointer !== 'object' ||
            storedPointer === null ||
            !('workspaceId' in storedPointer) ||
            typeof storedPointer.workspaceId !== 'string' ||
            !('path' in storedPointer) ||
            typeof storedPointer.path !== 'string'
          ) {
            throw new Error('Malformed active workflow persistence pointer')
          }
          const pointer: ActivePathPointer = {
            workspaceId: storedPointer.workspaceId,
            path: failedPath
          }
          sessionStorage.setItem(activePathKey, JSON.stringify(pointer))
        },
        {
          activePathKey: StorageKeys.activePath(clientId),
          failedPath: 'workflows/boot-failure.json'
        }
      )
    })

    test('falls back to the latest valid draft', async ({ comfyPage }) => {
      test.slow()
      await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
      await comfyPage.waitForAppReady()
      await comfyPage.menu.workflowsTab.open()

      await expect(
        comfyPage.menu.workflowsTab.activeWorkflowLabel
      ).toContainText('stable', { timeout: 5000 })
      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(2)
    })
  })
})
