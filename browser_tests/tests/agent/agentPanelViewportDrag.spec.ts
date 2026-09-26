import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

// Matrix rank 83: https://linear.app/comfyorg/issue/PM-1242
test.describe(
  'Agent panel viewport bounds',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test.use({ viewport: { width: 700, height: 800 } })

    test.beforeEach(async ({ agentPanel, comfyMouse, comfyPage }) => {
      const page = comfyPage.page
      await agentPanel.open()

      const panel = page.getByTestId('docked-agent-panel')
      await expect(panel).toBeInViewport({ ratio: 1 })
      await expect(comfyPage.menu.sideToolbar).toBeInViewport({ ratio: 1 })
      await expect(comfyPage.actionbar.root).toBeInViewport({ ratio: 1 })
      await expect(comfyPage.actionbar.queueButton.root).toBeInViewport({
        ratio: 1
      })

      const resizeHandle = page.getByTestId('agent-panel-resize-handle')
      const handleBox = await resizeHandle.boundingBox()
      if (!handleBox)
        throw new Error('Agent panel resize handle is not visible')

      const handleCenterX = handleBox.x + handleBox.width / 2
      const handleCenterY = handleBox.y + handleBox.height / 2
      await comfyMouse.dragAndDrop(
        { x: handleCenterX, y: handleCenterY },
        { x: 0, y: handleCenterY }
      )
      await expect(panel).toHaveCSS('width', '960px')
    })

    test('keeps the sidebar reachable after a wide panel drag', async ({
      comfyPage
    }) => {
      const sidebar = comfyPage.menu.sideToolbar
      await expect(sidebar).toHaveCount(1)
      test.fail(
        true,
        'Current main lets a wide panel drag hide the sidebar outside the viewport'
      )
      await expect(sidebar).toBeInViewport({ ratio: 1 })
    })

    test('keeps the canvas toolbar reachable after a wide panel drag', async ({
      comfyPage
    }) => {
      const toolbar = comfyPage.actionbar.root
      await expect(toolbar).toHaveCount(1)
      test.fail(
        true,
        'Current main lets a wide panel drag hide the canvas toolbar outside the viewport'
      )
      await expect(toolbar).toBeInViewport({ ratio: 1 })
    })

    test('keeps the Run control reachable after a wide panel drag', async ({
      comfyPage
    }) => {
      const runControl = comfyPage.actionbar.queueButton.root
      await expect(runControl).toHaveCount(1)
      test.fail(
        true,
        'Current main lets a wide panel drag hide the Run control outside the viewport'
      )
      await expect(runControl).toBeInViewport({ ratio: 1 })
    })

    test('keeps the panel fully inside the viewport after a wide drag', async ({
      comfyPage
    }) => {
      const panel = comfyPage.page.getByTestId('docked-agent-panel')
      await expect(panel).toHaveCount(1)
      test.fail(
        true,
        'Current main lets a wide panel drag push the dock beyond the viewport'
      )
      await expect(panel).toBeInViewport({ ratio: 1 })
    })
  }
)
