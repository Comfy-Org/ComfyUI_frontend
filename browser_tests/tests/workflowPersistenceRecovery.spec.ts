import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const generateUniqueFilename = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

test.describe('Workflow persistence recovery regressions', () => {
  test('Repairs real V1 workflow draft storage after a false V2 migration marker', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #14897 — V2 migration looked for scoped V1 keys and treated an empty V2 index as a permanent migration marker'
    })

    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )

    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    const legacyWorkflow = await comfyPage.workflow.getExportedWorkflow()
    const legacyName = `legacy-${generateUniqueFilename()}`
    const legacyPath = `workflows/${legacyName}.json`
    const legacyData = JSON.stringify(legacyWorkflow)

    await comfyPage.page.evaluate(
      ({ path, name, data }) => {
        const removeKeysWithPrefix = (storage: Storage, prefix: string) => {
          for (let i = storage.length - 1; i >= 0; i--) {
            const key = storage.key(i)
            if (key?.startsWith(prefix)) storage.removeItem(key)
          }
        }

        removeKeysWithPrefix(localStorage, 'Comfy.Workflow.Draft.v2:personal:')
        localStorage.removeItem('Comfy.Workflow.LastActivePath:personal')
        localStorage.removeItem('Comfy.Workflow.LastOpenPaths:personal')
        removeKeysWithPrefix(sessionStorage, 'Comfy.Workflow.ActivePath:')
        removeKeysWithPrefix(sessionStorage, 'Comfy.Workflow.OpenPaths:')

        localStorage.setItem(
          'Comfy.Workflow.Drafts',
          JSON.stringify({
            [path]: {
              data,
              updatedAt: Date.now(),
              name: `${name}.json`,
              isTemporary: true
            }
          })
        )
        localStorage.setItem(
          'Comfy.Workflow.DraftOrder',
          JSON.stringify([path])
        )
        localStorage.setItem(
          'Comfy.Workflow.DraftIndex.v2:personal',
          JSON.stringify({
            v: 2,
            updatedAt: Date.now(),
            order: [],
            entries: {}
          })
        )
        localStorage.setItem('Comfy.OpenWorkflowsPaths', JSON.stringify([path]))
        localStorage.setItem('Comfy.ActiveWorkflowIndex', JSON.stringify(0))
        localStorage.setItem('workflow', data)
      },
      { path: legacyPath, name: legacyName, data: legacyData }
    )

    await comfyPage.workflow.reloadAndWaitForApp()
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect
      .poll(() => comfyPage.menu.topbar.getActiveTabName())
      .toContain(legacyName)
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)

    const storageState = await comfyPage.page.evaluate((path) => {
      const rawIndex = localStorage.getItem(
        'Comfy.Workflow.DraftIndex.v2:personal'
      )
      const index = rawIndex
        ? (JSON.parse(rawIndex) as {
            entries?: Record<string, { path?: string }>
          })
        : null
      const rawOpenPaths = localStorage.getItem(
        'Comfy.Workflow.LastOpenPaths:personal'
      )
      const openPaths = rawOpenPaths
        ? (JSON.parse(rawOpenPaths) as { paths?: string[] })
        : null

      return {
        hasV2Entry: Object.values(index?.entries ?? {}).some(
          (entry) => entry.path === path
        ),
        legacyDrafts: localStorage.getItem('Comfy.Workflow.Drafts'),
        legacyOrder: localStorage.getItem('Comfy.Workflow.DraftOrder'),
        legacyWorkflow: localStorage.getItem('workflow'),
        durableOpenPaths: openPaths?.paths ?? []
      }
    }, legacyPath)

    expect(storageState.hasV2Entry).toBe(true)
    expect(storageState.legacyDrafts).toBeNull()
    expect(storageState.legacyOrder).toBeNull()
    expect(storageState.legacyWorkflow).toBeNull()
    expect(storageState.durableOpenPaths).toContain(legacyPath)
    await expect(comfyPage.toast.toastErrors).toHaveCount(0)
  })

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
      // pagehide flushes the pending debounce synchronously. Dispatch it twice
      // to deterministically exercise repeated lifecycle persistence without a
      // wall-clock observation window.
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
