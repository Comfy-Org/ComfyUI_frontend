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
      const resizeHandle = page.getByTestId('agent-panel-resize-handle')
      const panelBox = await panel.boundingBox()
      const handleBox = await resizeHandle.boundingBox()
      if (!panelBox) throw new Error('Agent panel is not visible')
      if (!handleBox)
        throw new Error('Agent panel resize handle is not visible')

      const handleCenterX = handleBox.x + handleBox.width / 2
      const handleCenterY = handleBox.y + handleBox.height / 2
      await comfyMouse.dragAndDrop(
        { x: handleCenterX, y: handleCenterY },
        { x: 0, y: handleCenterY }
      )
      await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBeGreaterThan(panelBox.width)
    })

    test('keeps the sidebar reachable after a wide panel drag', async ({
      comfyPage
    }) => {
      const sidebar = comfyPage.menu.sideToolbar
      await expect(sidebar).toBeVisible()
      await expect(sidebar).toBeInViewport({ ratio: 1 })
    })

    test('keeps the canvas toolbar reachable after a wide panel drag', async ({
      comfyPage
    }) => {
      const toolbar = comfyPage.actionbar.root
      await expect(toolbar).toBeVisible()
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
      await expect(runControl).toBeVisible()
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
      await expect(panel).toBeVisible()
      await expect(panel).toBeInViewport({ ratio: 1 })
    })
  }
)
