import type { Page, Request } from '@playwright/test'

import type {
  ComfyApiWorkflow,
  NodeId
} from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

function isUserdataWorkflowSave(request: Request): boolean {
  return (
    request.method() === 'POST' &&
    /\/api\/userdata\/workflows%2F[^?]+\.json/.test(request.url())
  )
}

function collectSaves(page: Page): Disposable & { readonly saves: string[] } {
  const saves: string[] = []
  function onRequest(request: Request) {
    if (isUserdataWorkflowSave(request)) saves.push(request.url())
  }
  page.on('request', onRequest)
  return {
    saves,
    [Symbol.dispose]() {
      page.off('request', onRequest)
    }
  }
}

async function waitForSave(page: Page, timeout: number): Promise<boolean> {
  return page
    .waitForRequest(isUserdataWorkflowSave, { timeout })
    .then(() => true)
    .catch(() => false)
}

/**
 * Drag the first node so the change tracker dispatches `graphChanged`.
 */
async function triggerGraphChange(comfyPage: ComfyPage): Promise<void> {
  const node = await comfyPage.nodeOps.getFirstNodeRef()
  if (!node) throw new Error('Default workflow expected to have a first node')
  const titlePos = await node.getTitlePosition()
  const absFrom = await comfyPage.canvasOps.toAbsolute(titlePos)
  const absTo = { x: absFrom.x + 120, y: absFrom.y + 120 }
  await comfyPage.canvasOps.dragAndDrop(absFrom, absTo)
  await expect
    .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
    .toBe(true)
}

async function setupAutoSaveAfterDelay(
  comfyPage: ComfyPage,
  delayMs: number
): Promise<void> {
  await comfyPage.menu.topbar.saveWorkflow('autosave')
  await comfyPage.settings.setSetting('Comfy.Workflow.AutoSaveDelay', delayMs)
  await comfyPage.settings.setSetting('Comfy.Workflow.AutoSave', 'after delay')
}

test.describe('Workflow settings', { tag: '@canvas' }, () => {
  test.describe('Comfy.Workflow.AutoSave', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.settings.setSetting('Comfy.Workflow.AutoSave', 'off')
    })

    test("'off' does not save modified workflow after delay", async ({
      comfyPage
    }) => {
      await comfyPage.menu.topbar.saveWorkflow('autosave')
      await comfyPage.settings.setSetting('Comfy.Workflow.AutoSaveDelay', 50)

      await triggerGraphChange(comfyPage)

      // Within a window an order of magnitude longer than AutoSaveDelay, the
      // off watcher must not write back.
      const sawSave = await waitForSave(comfyPage.page, 500)
      expect(
        sawSave,
        'AutoSave=off must not write back after a graph change'
      ).toBe(false)
    })

    test("'after delay' saves the workflow after a graph change", async ({
      comfyPage
    }) => {
      await setupAutoSaveAfterDelay(comfyPage, 100)

      const savePromise = comfyPage.page.waitForRequest(
        isUserdataWorkflowSave,
        { timeout: 4000 }
      )
      await triggerGraphChange(comfyPage)
      await savePromise

      await expect
        .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
        .toBe(false)
    })
  })

  test.describe('Comfy.Workflow.AutoSaveDelay', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.settings.setSetting('Comfy.Workflow.AutoSave', 'off')
    })

    test('long delay defers save until at least the configured duration has elapsed', async ({
      comfyPage
    }) => {
      const LONG_DELAY_MS = 1000
      const EARLY_WINDOW_MS = 500

      await setupAutoSaveAfterDelay(comfyPage, LONG_DELAY_MS)

      using tracker = collectSaves(comfyPage.page)

      await triggerGraphChange(comfyPage)

      // No save fires within a window comfortably shorter than the delay.
      const sawEarlySave = await waitForSave(comfyPage.page, EARLY_WINDOW_MS)
      expect(
        sawEarlySave,
        `No save should fire within ${EARLY_WINDOW_MS}ms when the configured delay is ${LONG_DELAY_MS}ms`
      ).toBe(false)

      // Eventually the save does fire.
      await comfyPage.page.waitForRequest(isUserdataWorkflowSave, {
        timeout: 3000
      })
      expect(tracker.saves).toHaveLength(1)
    })
  })

  test.describe('Comfy.Workflow.SortNodeIdOnSave', () => {
    async function getSerializedNodeIds(
      comfyPage: ComfyPage
    ): Promise<NodeId[]> {
      return (await comfyPage.workflow.getExportedWorkflow()).nodes.map(
        (n) => n.id
      )
    }

    function ascendingById(ids: NodeId[]): NodeId[] {
      return [...ids].sort((a, b) => Number(a) - Number(b))
    }

    test('false preserves the graph insertion order', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')

      await comfyPage.settings.setSetting(
        'Comfy.Workflow.SortNodeIdOnSave',
        false
      )
      const ids = await getSerializedNodeIds(comfyPage)

      expect(ids, 'default workflow nodes already sorted').not.toEqual(
        ascendingById(ids)
      )
    })

    test('true sorts nodes by id ascending', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.SortNodeIdOnSave',
        true
      )
      const ids = await getSerializedNodeIds(comfyPage)
      expect(ids).toEqual(ascendingById(ids))
    })

    test('toggling sort preserves node set in both workflow JSON and API prompt', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.SortNodeIdOnSave',
        false
      )
      const expectedIds = ascendingById(await getSerializedNodeIds(comfyPage))

      await comfyPage.settings.setSetting(
        'Comfy.Workflow.SortNodeIdOnSave',
        true
      )

      // Workflow JSON nodes (the surface controlled by SortNodeIdOnSave) must
      // still contain the same set of ids — sort changes order, not membership.
      expect(ascendingById(await getSerializedNodeIds(comfyPage))).toEqual(
        expectedIds
      )

      // The API prompt is independently derived from execution order, but it
      // must enumerate the same node set regardless of the sort flag.
      const apiPrompt: ComfyApiWorkflow =
        await comfyPage.workflow.getExportedWorkflow({ api: true })
      expect(ascendingById(Object.keys(apiPrompt).map(Number))).toEqual(
        expectedIds
      )
    })
  })
})
