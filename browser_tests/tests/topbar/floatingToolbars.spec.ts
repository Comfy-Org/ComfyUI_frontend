import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { readPanelStyle } from '@e2e/fixtures/helpers/PanelStyleHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

test.describe('Floating toolbars', { tag: ['@ui', '@canvas'] }, () => {
  test.use({ initialSettings: { 'Comfy.Graph.CanvasMenu': true } })

  test('graph toggle, actionbar card and canvas menu share one panel style', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.appMode.workflowActions.viewModeToggle
    const card = comfyPage.actionbar.card
    const canvasMenu = comfyPage.canvasMenu.root
    await expect(toggle).toBeVisible()
    await expect(card).toBeVisible()
    await expect(canvasMenu).toBeVisible()

    const [toggleStyle, cardStyle, canvasMenuStyle] = await Promise.all([
      readPanelStyle(toggle),
      readPanelStyle(card),
      readPanelStyle(canvasMenu)
    ])
    expect(toggleStyle.borderStyle).toBe('none')
    expect(cardStyle).toEqual(toggleStyle)
    expect(canvasMenuStyle).toEqual(toggleStyle)
  })

  test('graph toggle and actionbar card start at the same top edge', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.appMode.workflowActions.viewModeToggle
    const card = comfyPage.actionbar.card
    await expect(toggle).toBeVisible()
    await expect(card).toBeVisible()

    const [toggleBox, cardBox] = await Promise.all([
      toggle.boundingBox(),
      card.boundingBox()
    ])
    expect(toggleBox?.y).toBe(cardBox?.y)
    expect(toggleBox?.height).toBe(cardBox?.height)
  })

  test('cancel run button is secondary while idle and destructive while running', async ({
    comfyPage,
    getWebSocket
  }) => {
    const cancel = comfyPage.actionbar.cancelButton
    await expect(cancel).toBeDisabled()
    await expect(cancel).toHaveClass(/bg-secondary-background/)
    await expect(cancel).not.toHaveClass(/destructive/)

    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const jobId = await exec.run()
    exec.executionStart(jobId)

    await expect(cancel).toBeEnabled()
    await expect(cancel).toHaveClass(/bg-destructive-background/)
  })
})
