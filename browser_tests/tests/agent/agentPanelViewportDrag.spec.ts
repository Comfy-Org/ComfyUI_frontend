import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

// Matrix rank 83: https://linear.app/comfyorg/issue/PM-1242
test.describe(
  'Agent panel viewport bounds',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test.use({ viewport: { width: 700, height: 800 } })

    test('keeps the panel and canvas controls reachable after a wide drag', async ({
      agentPanel,
      comfyPage
    }) => {
      test.fail(
        true,
        'Current main lets a wide panel drag push the dock beyond the viewport'
      )
      const page = comfyPage.page
      await agentPanel.open()

      const panel = page.getByTestId('docked-agent-panel')
      const resizeHandle = page.getByTestId('agent-panel-resize-handle')
      const handleBox = await resizeHandle.boundingBox()
      if (!handleBox)
        throw new Error('Agent panel resize handle is not visible')

      const handleCenterX = handleBox.x + handleBox.width / 2
      const handleCenterY = handleBox.y + handleBox.height / 2
      await page.mouse.move(handleCenterX, handleCenterY)
      await page.mouse.down()
      await page.mouse.move(0, handleCenterY)
      await page.mouse.up()

      await expect
        .poll(async () => {
          const viewport = page.viewportSize()
          if (!viewport) throw new Error('This test requires a sized viewport')
          const [panelBox, sidebarBox, toolbarBox, runBox] = await Promise.all([
            panel.boundingBox(),
            comfyPage.menu.sideToolbar.boundingBox(),
            comfyPage.actionbar.root.boundingBox(),
            comfyPage.actionbar.queueButton.root.boundingBox()
          ])
          const fullyVisible = (
            box: Awaited<ReturnType<typeof panel.boundingBox>>
          ) =>
            box !== null &&
            box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= viewport.width &&
            box.y + box.height <= viewport.height

          return {
            canvasToolbar: fullyVisible(toolbarBox),
            panel: fullyVisible(panelBox),
            runControl: fullyVisible(runBox),
            sidebar: fullyVisible(sidebarBox)
          }
        })
        .toEqual({
          canvasToolbar: true,
          panel: true,
          runControl: true,
          sidebar: true
        })
    })
  }
)
