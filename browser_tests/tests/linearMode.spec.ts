import type { Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test.describe('Linear Mode', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setup()
  })

  async function enterAppMode(comfyPage: {
    page: Page
    nextFrame: () => Promise<void>
  }) {
    // LinearControls requires hasOutputs to be true. Serialize the current
    // graph, inject linearData with output node IDs, then reload so the
    // appModeStore picks up the outputs via its activeWorkflow watcher.
    await comfyPage.page.evaluate(async () => {
      const graph = window.app!.graph
      if (!graph) return

      const outputNodeIds = graph.nodes
        .filter(
          (n: { type?: string }) =>
            n.type === 'SaveImage' || n.type === 'PreviewImage'
        )
        .map((n: { id: number | string }) => String(n.id))

      // Serialize, inject linearData, and reload to sync stores
      const workflow = graph.serialize() as unknown as Record<string, unknown>
      const extra = (workflow.extra ?? {}) as Record<string, unknown>
      extra.linearData = { inputs: [], outputs: outputNodeIds }
      workflow.extra = extra
      await window.app!.loadGraphData(
        workflow as unknown as Parameters<
          NonNullable<typeof window.app>['loadGraphData']
        >[0]
      )
    })
    await comfyPage.nextFrame()

    // Toggle to app mode via the command which sets canvasStore.linearMode
    await comfyPage.page.evaluate(() => {
      window.app!.extensionManager.command.execute('Comfy.ToggleLinear')
    })
    await comfyPage.nextFrame()
  }

  async function enterGraphMode(comfyPage: {
    page: Page
    nextFrame: () => Promise<void>
  }) {
    await comfyPage.page.evaluate(() => {
      window.app!.extensionManager.command.execute('Comfy.ToggleLinear')
    })
    await comfyPage.nextFrame()
  }

  test('Displays linear controls when app mode active', async ({
    comfyPage
  }) => {
    await enterAppMode(comfyPage)

    await expect(
      comfyPage.page.locator('[data-testid="linear-widgets"]')
    ).toBeVisible({ timeout: 5000 })
  })

  test('Run button visible in linear mode', async ({ comfyPage }) => {
    await enterAppMode(comfyPage)

    await expect(
      comfyPage.page.locator('[data-testid="linear-run-button"]')
    ).toBeVisible({ timeout: 5000 })
  })

  test('Workflow info section visible', async ({ comfyPage }) => {
    await enterAppMode(comfyPage)

    await expect(
      comfyPage.page.locator('[data-testid="linear-workflow-info"]')
    ).toBeVisible({ timeout: 5000 })
  })

  test('Returns to graph mode', async ({ comfyPage }) => {
    await enterAppMode(comfyPage)

    await expect(
      comfyPage.page.locator('[data-testid="linear-widgets"]')
    ).toBeVisible({ timeout: 5000 })

    await enterGraphMode(comfyPage)

    await expect(comfyPage.canvas).toBeVisible({ timeout: 5000 })
    await expect(
      comfyPage.page.locator('[data-testid="linear-widgets"]')
    ).not.toBeVisible()
  })

  test('Canvas not visible in app mode', async ({ comfyPage }) => {
    await enterAppMode(comfyPage)

    await expect(
      comfyPage.page.locator('[data-testid="linear-widgets"]')
    ).toBeVisible({ timeout: 5000 })
    await expect(comfyPage.canvas).not.toBeVisible()
  })
})
