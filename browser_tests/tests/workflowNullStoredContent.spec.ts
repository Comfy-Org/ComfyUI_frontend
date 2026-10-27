import type { Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'

/**
 * Production crashes CLOUD-FRONTEND-PROD-2Z2, -2Z3, -28Y and -233
 * (`null is not an object (evaluating 'e.initialState.extra')` /
 * `(evaluating 'e.nodes')`, frontend 1.56.3 and 1.57.0): a saved workflow
 * whose stored content is JSON `null` is reused by name, which leaves the
 * active workflow's change tracker with a null initial state. Every later
 * canvas capture, graph load and app-mode refresh then throws.
 */

const WORKFLOW_PATH = 'workflows/default.json'

interface DraftCopy {
  indexKey: string
  draftKey: string
  entry: Record<string, unknown>
  payloadKey: string
  payload: string
}

async function readDraft(page: Page): Promise<DraftCopy | null> {
  return page.evaluate((path) => {
    for (const indexKey of Object.keys(localStorage)) {
      if (!indexKey.startsWith('Comfy.Workflow.DraftIndex.v2:')) continue
      const index = JSON.parse(localStorage.getItem(indexKey)!)
      for (const [draftKey, entry] of Object.entries(index.entries)) {
        if ((entry as { path: string }).path !== path) continue
        const workspace = indexKey.slice('Comfy.Workflow.DraftIndex.v2:'.length)
        const payloadKey = `Comfy.Workflow.Draft.v2:${workspace}:${draftKey}`
        const payload = localStorage.getItem(payloadKey)
        if (!payload) return null
        return {
          indexKey,
          draftKey,
          entry: entry as Record<string, unknown>,
          payloadKey,
          payload
        }
      }
    }
    return null
  }, WORKFLOW_PATH)
}

/**
 * Leaves `workflows/default.json` closed, stored as JSON `null`, with a
 * local draft newer than the stored file: the state the crashing sessions
 * were in when they reused the workflow by name.
 */
async function seedNullStoredWorkflowWithDraft(comfyPage: ComfyPage) {
  const { page } = comfyPage
  await comfyPage.workflow.setupWorkflowsDirectory({})
  await comfyPage.menu.topbar.saveWorkflow('default')

  await page.evaluate(() => {
    window.app!.graph.add(window.LiteGraph!.createNode('Note'))
    ;(
      window.app!.extensionManager as WorkspaceStore
    ).workflow.activeWorkflow!.changeTracker.captureCanvasState()
  })
  await expect
    .poll(async () => (await readDraft(page))?.payload.includes('Note'))
    .toBe(true)
  const draft = await readDraft(page)
  if (!draft) throw new Error(`No draft persisted for ${WORKFLOW_PATH}`)

  // Closing a tab discards its draft; the draft is restored below.
  await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
  await comfyPage.menu.topbar.closeWorkflowTab('default')

  await page.evaluate(
    async ({ path, draft }) => {
      const api = window.app!.api
      await api.storeUserData(path, 'null', {
        overwrite: true,
        stringify: false,
        throwOnError: true
      })
      const stored = (await api.listUserDataFullInfo('workflows')).find(
        (file) => `workflows/${file.path}` === path
      )
      if (!stored) throw new Error(`${path} was not stored`)
      const updatedAt = Math.max(Date.now(), stored.modified) + 1
      const payload = JSON.parse(draft.payload)
      localStorage.setItem(
        draft.payloadKey,
        JSON.stringify({ ...payload, updatedAt })
      )
      const index = JSON.parse(localStorage.getItem(draft.indexKey)!)
      index.entries[draft.draftKey] = { ...draft.entry, updatedAt }
      if (!index.order.includes(draft.draftKey))
        index.order.push(draft.draftKey)
      index.updatedAt = updatedAt
      localStorage.setItem(draft.indexKey, JSON.stringify(index))
    },
    { path: WORKFLOW_PATH, draft }
  )
}

test.describe(
  'Workflow whose stored content is null',
  { tag: '@workflow' },
  () => {
    test('reusing it by name does not leave the app throwing on every edit and load', async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      await seedNullStoredWorkflowWithDraft(comfyPage)

      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      await comfyPage.workflow.reloadAndWaitForApp()

      // Dropping default.json loads it under the name "default", which
      // reuses the stored workflows/default.json.
      await comfyPage.dragDrop.dragAndDropFile('default.json', {
        waitForUpload: false
      })
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(7)

      // An ordinary canvas gesture: mouseup captures the canvas state.
      const canvas = page.locator('#graph-canvas')
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas is not visible')
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 40)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height - 20)
      await page.mouse.up()

      // Loading another graph deactivates the current workflow and fires
      // the graph's `configured` event.
      await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

      expect(pageErrors).toEqual([])

      // Not a silent wipe: the stored file is not rewritten and the local
      // draft that holds the user's last edits survives.
      const storedContent = await page.evaluate(async (path) => {
        const response = await window.app!.api.getUserData(path)
        return response.text()
      }, WORKFLOW_PATH)
      expect(storedContent).toBe('null')
      expect(await readDraft(page)).not.toBeNull()
    })
  }
)
