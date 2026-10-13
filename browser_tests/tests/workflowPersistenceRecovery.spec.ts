import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const generateUniqueFilename = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

test.describe('Workflow persistence recovery regressions', () => {
  test('Does not save a startup-only workflow and deduplicates load failures', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #14897 — startup graph loads and repeated lifecycle draft writes could emit repeated quota errors'
    })

    await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
    await comfyPage.page.addInitScript(() => {
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = function (key: string, value: string) {
        if (
          key.startsWith('Comfy.Workflow.Draft.v2:') ||
          key.startsWith('Comfy.Workflow.DraftIndex.v2:')
        ) {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        }
        return originalSetItem.call(this, key, value)
      }
    })

    await comfyPage.workflow.reloadAndWaitForApp()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect(comfyPage.toast.toastErrors).toHaveCount(0)

    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect(comfyPage.toast.toastErrors).toHaveCount(1)

    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.workflow.waitForWorkflowIdle()
    await comfyPage.page.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'))
      window.dispatchEvent(new Event('pagehide'))
    })

    await expect(comfyPage.toast.toastErrors).toHaveCount(1)
  })

  test('Restores a clean saved workflow viewport from its persisted draft', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #14897 — view-only drafts for saved workflows were deleted, so restart could fit the graph instead of restoring the last viewport'
    })

    await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
    await comfyPage.settings.setSetting('Comfy.EnableWorkflowViewRestore', true)
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

    const workflowName = `viewport-${generateUniqueFilename()}`
    await comfyPage.menu.topbar.saveWorkflow(workflowName)
    await expect
      .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
      .toBe(false)

    const draftSaveStartedAt = Date.now()
    await comfyPage.canvasOps.setScale(0.73)
    await comfyPage.canvasOps.pan({ x: 143, y: -87 })
    const expectedScale = await comfyPage.canvasOps.getScale()
    const expectedOffset = await comfyPage.canvasOps.getOffset()

    await comfyPage.page.evaluate(() =>
      window.dispatchEvent(new Event('pagehide'))
    )
    await comfyPage.workflow.waitForDraftIndexUpdatedSince(draftSaveStartedAt)

    const activePath = await comfyPage.workflow.getActiveWorkflowPath()
    expect(activePath).toBe(`workflows/${workflowName}.json`)
    if (!activePath) throw new Error('Expected an active saved workflow path')

    // fallow-ignore-next-line complexity -- test-only browser storage decoder keeps the persisted index/payload traversal visible at the assertion site.
    const persistedViewport = await comfyPage.page.evaluate((path) => {
      const indexPrefix = 'Comfy.Workflow.DraftIndex.v2:'
      for (let i = 0; i < localStorage.length; i++) {
        const indexKey = localStorage.key(i)
        if (!indexKey?.startsWith(indexPrefix)) continue

        const rawIndex = localStorage.getItem(indexKey)
        if (!rawIndex) continue
        const index = JSON.parse(rawIndex) as {
          entries?: Record<string, { path?: string }>
        }
        const draftKey = Object.entries(index.entries ?? {}).find(
          ([, entry]) => entry.path === path
        )?.[0]
        if (!draftKey) continue

        const workspaceId = indexKey.slice(indexPrefix.length)
        const rawPayload = localStorage.getItem(
          `Comfy.Workflow.Draft.v2:${workspaceId}:${draftKey}`
        )
        if (!rawPayload) continue
        const payload = JSON.parse(rawPayload) as { data?: string }
        if (!payload.data) continue
        const workflow = JSON.parse(payload.data) as {
          extra?: { ds?: { scale?: number; offset?: number[] } }
        }
        return workflow.extra?.ds ?? null
      }
      return null
    }, activePath)

    expect(persistedViewport?.scale).toBeCloseTo(expectedScale, 2)
    expect(persistedViewport?.offset?.[0]).toBeCloseTo(expectedOffset[0], 1)
    expect(persistedViewport?.offset?.[1]).toBeCloseTo(expectedOffset[1], 1)

    await comfyPage.workflow.reloadAndWaitForApp()
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect
      .poll(() => comfyPage.canvasOps.getScale())
      .toBeCloseTo(expectedScale, 2)
    await expect
      .poll(async () => (await comfyPage.canvasOps.getOffset())[0])
      .toBeCloseTo(expectedOffset[0], 1)
    await expect
      .poll(async () => (await comfyPage.canvasOps.getOffset())[1])
      .toBeCloseTo(expectedOffset[1], 1)
    await expect
      .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
      .toBe(false)
  })
})
