import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import type { ComfyPage } from '../fixtures/ComfyPage'

const generateUniqueFilename = (extension = '') =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${extension}`

const waitForV2DraftSave = async (comfyPage: ComfyPage, since: number) => {
  await comfyPage.page.waitForFunction((savedSince) => {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith('Comfy.Workflow.DraftIndex.v2:')) continue

      const json = window.localStorage.getItem(key)
      if (!json) continue

      try {
        const index = JSON.parse(json)
        if (
          typeof index.updatedAt === 'number' &&
          index.updatedAt >= savedSince
        ) {
          return true
        }
      } catch {
        // Ignore malformed storage while waiting for the debounce to flush.
      }
    }

    return false
  }, since)
}

const waitForTabStatePersistence = async (
  comfyPage: ComfyPage,
  minPaths = 2
) => {
  await comfyPage.page.waitForFunction((expectedMinPaths) => {
    let activePathKey: string | null = null
    let openPathsKey: string | null = null

    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)
      if (key?.startsWith('Comfy.Workflow.ActivePath:')) {
        activePathKey = key
      }
      if (key?.startsWith('Comfy.Workflow.OpenPaths:')) {
        openPathsKey = key
      }
    }

    if (!activePathKey || !openPathsKey) {
      return false
    }

    const activePointerRaw = window.sessionStorage.getItem(activePathKey)
    const openPointerRaw = window.sessionStorage.getItem(openPathsKey)
    if (!activePointerRaw || !openPointerRaw) {
      return false
    }

    try {
      const activePointer = JSON.parse(activePointerRaw) as {
        workspaceId?: unknown
        path?: unknown
      }
      const openPointer = JSON.parse(openPointerRaw) as {
        paths?: unknown[]
      }

      return (
        typeof activePointer.workspaceId === 'string' &&
        typeof activePointer.path === 'string' &&
        Array.isArray(openPointer.paths) &&
        openPointer.paths.length >= expectedMinPaths
      )
    } catch {
      return false
    }
  }, minPaths)
}

const forceActivePathToFirstOpenWorkflow = async (comfyPage: ComfyPage) => {
  await comfyPage.page.evaluate(() => {
    let activePathKey: string | null = null
    let openPathsKey: string | null = null

    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)
      if (key?.startsWith('Comfy.Workflow.ActivePath:')) {
        activePathKey = key
      }
      if (key?.startsWith('Comfy.Workflow.OpenPaths:')) {
        openPathsKey = key
      }
    }

    if (!activePathKey || !openPathsKey) {
      throw new Error('Expected workflow persistence session state to exist')
    }

    const activePointerRaw = window.sessionStorage.getItem(activePathKey)
    const openPointerRaw = window.sessionStorage.getItem(openPathsKey)
    if (!activePointerRaw || !openPointerRaw) {
      throw new Error('Expected workflow persistence session payloads to exist')
    }

    const activePointer = JSON.parse(activePointerRaw) as {
      workspaceId: string
      path: string
    }
    const openPointer = JSON.parse(openPointerRaw) as {
      workspaceId: string
      paths: string[]
      activeIndex: number
    }

    if (openPointer.paths.length < 2) {
      throw new Error('Expected at least two saved workflow paths in tab state')
    }

    activePointer.path = openPointer.paths[0]
    openPointer.activeIndex = 1

    window.sessionStorage.setItem(activePathKey, JSON.stringify(activePointer))
    window.sessionStorage.setItem(openPathsKey, JSON.stringify(openPointer))
  })
}

test.describe('Workflow persistence regressions', { tag: '@workflow' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    await comfyPage.workflow.setupWorkflowsDirectory({})
    await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
  })

  test('restores all saved tabs even when active-path state is stale, and restores saved-workflow drafts', async ({
    comfyPage
  }) => {
    const workflowA = generateUniqueFilename()
    const workflowB = generateUniqueFilename()

    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.menu.topbar.saveWorkflow(workflowA)

    const firstNode = (await comfyPage.nodeOps.getFirstNodeRef())!
    const draftSaveStartedAt = Date.now()
    await firstNode.click('collapse')
    await comfyPage.canvasOps.clickEmptySpace()
    expect(await firstNode.isCollapsed()).toBe(true)

    await waitForV2DraftSave(comfyPage, draftSaveStartedAt)

    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.menu.topbar.saveWorkflow(workflowB)

    await waitForTabStatePersistence(comfyPage)
    await forceActivePathToFirstOpenWorkflow(comfyPage)

    await comfyPage.setup({ clearStorage: false })
    await comfyPage.nextFrame()

    const tabs = await comfyPage.menu.topbar.getTabNames()
    expect(tabs).toEqual(expect.arrayContaining([workflowA, workflowB]))
    expect(tabs.indexOf(workflowA)).toBeLessThan(tabs.indexOf(workflowB))
    expect(await comfyPage.menu.topbar.getActiveTabName()).toBe(workflowB)

    await comfyPage.menu.topbar.getWorkflowTab(workflowA).click()
    await comfyPage.nextFrame()
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)

    const restoredNode = (await comfyPage.nodeOps.getFirstNodeRef())!
    expect(await restoredNode.isCollapsed()).toBe(true)
    expect(await comfyPage.toast.getToastErrorCount()).toBe(0)
  })
})
