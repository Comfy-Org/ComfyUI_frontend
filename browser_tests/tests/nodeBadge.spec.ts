import { expect } from '@playwright/test'

import type { ComfyApp } from '@/scripts/app'
import { NodeBadgeMode } from '@/types/nodeSource'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  await comfyPage.closeMenu()
})

test.describe('Node Badge', { tag: ['@screenshot', '@smoke', '@node'] }, () => {
  test('Can add badge', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      const LGraphBadge = window.LGraphBadge!
      const app = window.app as ComfyApp
      const graph = app.graph
      const nodes = graph.nodes

      for (const node of nodes) {
        node.badges = [new LGraphBadge({ text: 'Test Badge' })]
      }

      graph.setDirtyCanvas(true, true)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('node-badge.png')
  })

  test('Can add multiple badges', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      const LGraphBadge = window.LGraphBadge!
      const app = window.app as ComfyApp
      const graph = app.graph
      const nodes = graph.nodes

      for (const node of nodes) {
        node.badges = [
          new LGraphBadge({ text: 'Test Badge 1' }),
          new LGraphBadge({ text: 'Test Badge 2' })
        ]
      }

      graph.setDirtyCanvas(true, true)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('node-badge-multiple.png')
  })

  test('Can add badge left-side', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      const LGraphBadge = window.LGraphBadge!
      const app = window.app as ComfyApp
      const graph = app.graph
      const nodes = graph.nodes

      for (const node of nodes) {
        node.badges = [new LGraphBadge({ text: 'Test Badge' })]
        // @ts-expect-error - Enum value
        node.badgePosition = 'top-left'
      }

      graph.setDirtyCanvas(true, true)
    })

    await expect(comfyPage.canvas).toHaveScreenshot('node-badge-left.png')
  })
})

test.describe(
  'Node source badge',
  { tag: ['@screenshot', '@smoke', '@node'] },
  () => {
    Object.values(NodeBadgeMode).forEach(async (mode) => {
      test(`Shows node badges (${mode})`, async ({ comfyPage }) => {
        // Execution error workflow has both custom node and core node.
        await comfyPage.workflow.loadWorkflow('nodes/execution_error')
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.NodeSourceBadgeMode',
          mode
        )
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.NodeIdBadgeMode',
          mode
        )
        await expect
          .poll(
            () =>
              comfyPage.settings.getSetting('Comfy.NodeBadge.NodeIdBadgeMode'),
            { message: 'NodeIdBadgeMode setting should be applied' }
          )
          .toBe(mode)
        await comfyPage.canvasOps.resetView()
        await expect(comfyPage.canvas).toHaveScreenshot(
          `node-badge-${mode}.png`
        )
      })
    })
  }
)

test.describe(
  'Node badge color',
  { tag: ['@screenshot', '@smoke', '@node'] },
  () => {
    test('Can show node badge with unknown color palette', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.NodeBadge.NodeIdBadgeMode',
        NodeBadgeMode.ShowAll
      )
      await comfyPage.settings.setSetting('Comfy.ColorPalette', 'unknown')
      await expect
        .poll(() => comfyPage.settings.getSetting('Comfy.ColorPalette'), {
          message: 'ColorPalette setting should be applied'
        })
        .toBe('unknown')
      await comfyPage.canvasOps.clickEmptySpace()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'node-badge-unknown-color-palette.png'
      )
    })

    test('Can show node badge with light color palette', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.NodeBadge.NodeIdBadgeMode',
        NodeBadgeMode.ShowAll
      )
      await comfyPage.settings.setSetting('Comfy.ColorPalette', 'light')
      await expect
        .poll(() => comfyPage.settings.getSetting('Comfy.ColorPalette'), {
          message: 'ColorPalette setting should be applied'
        })
        .toBe('light')
      await comfyPage.canvasOps.clickEmptySpace()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'node-badge-light-color-palette.png'
      )
    })
  }
)
